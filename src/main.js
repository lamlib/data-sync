/** @type {Map<string, any>} Dữ liệu chính sau khi sync từ server */
const dataStore = new Map();

/** @type {Map<string, any>} Bộ nhớ đệm tham số dùng để tránh gọi lại nếu không thay đổi */
const paramCache = new Map();

/** Số lượng request đang trong trạng thái loading */
let activeRequestCount = 0;

/** Các hàm callback khi trạng thái request thay đổi */
const loadingHooks = {
    onQueueEmpty: null,
    onQueueAdd: null,
};

/** Trạng thái thông báo lỗi và thành công */
const messageState = {
    error: null,
    success: null,
};

/** Kiểm tra xem có lỗi xảy ra không */
const hasError = () => !!messageState.error;

/**
 * Gán các hàm hook để xử lý UI loading khi có request
 * @param {{ onQueueAdd(): void; onQueueEmpty(): void }} hooks
 */
const setLoadingHooks = ({ onQueueAdd, onQueueEmpty }) => {
    if (onQueueAdd && onQueueEmpty) {
        loadingHooks.onQueueAdd = onQueueAdd;
        loadingHooks.onQueueEmpty = onQueueEmpty;
    } else {
        console.warn('⚠️ DataSync: Missing loading hooks. Use setLoadingHooks() to register.');
    }
};

const responseOperator = {
    picker: (result) => {
        return result.data || result.result;
    },
    errCatcher: (response, result) => {
        if (
            result.code && result.code !== 'SUCCESS' || 
            result.result === false || 
            !response.ok
        ) throw new Error(result.message);
    },
    reset: () => {
        responseOperator.picker = (result) => result.data || result.result;
        responseOperator.errCatcher = (response, result) => {
            if (
                result.code && result.code !== 'SUCCESS' || 
                result.result === false || 
                !response.ok
            ) throw new Error(result.message);
        };
    }
}

const setResponseOperator = ({ picker, errCatcher }) => {
    if (typeof errCatcher === 'function') responseOperator.after = errCatcher;
    else console.warn('⚠️ DataSync: Invalid errCatcher response operator.');
    if (typeof picker === 'function') responseOperator.before = picker
    else console.warn('⚠️ DataSync: Invalid picker response operator.');
}
/**
 * Kiểm tra param có thay đổi không
 * @param {string} key 
 * @param {any[]} params 
 * @returns {boolean}
 */
const isSameParams = (key, params) => {
    if (!paramCache.has(key)) return false;
    const cachedParams = paramCache.get(key);
    if (cachedParams.length !== params.length) return false;
    return cachedParams.every((p, i) => p === params[i]);
};

/**
 * Xử lý đồng bộ dữ liệu với máy chủ, có cache và loading hooks
 * @param {Function} fetchFn 
 * @param {string} key 
 * @param {any[]|false} params 
 * @returns {Promise<any>}
 */
const syncData = async (fetchFn, key, params) => {
    messageState.error = null;
    messageState.success = null;
    try {
        if (!!params !== false) {
            if (isSameParams(key, params)) {
                console.warn('⚠️ DataSync: Using cached data, skipping request.');
                return;
            }
            paramCache.set(key, params);
        }

        const timeout = 600;
        const timeoutId = setTimeout(() => {
            activeRequestCount++;
            loadingHooks.onQueueAdd && loadingHooks.onQueueAdd();
        }, timeout);

        dataStore.set(key, null);
        /**@type {Response} */
        const response = await fetchFn();
        clearTimeout(timeoutId);

        const result = await response.json();

        interceptors.after && interceptors.after(result);

        responseOperator.errCatcher(response, result);

        

        const data = responseOperator.picker(result);
        dataStore.set(key, data);

        if (result.message) messageState.success = result.message;
        return data;
    } catch (err) {
        messageState.error = err;
        console.log(err);
    } finally {
        if (activeRequestCount > 0) activeRequestCount--;
        if (activeRequestCount === 0) {
            loadingHooks.onQueueEmpty && loadingHooks.onQueueEmpty();
        }
        
    }
};

const requestHandlers = {};

const interceptors = {
    before: null,
    after: null,
}

/**
 * Thay thế path parameters trong URL
 * @param {string} url URL có chứa path params như /api/x/:id
 * @param {object} pathParams Object chứa các path params
 * @returns {{ finalUrl: string, remainingParams: object }}
 */
const buildUrlWithPathParams = (url, pathParams = {}) => {
    let finalUrl = url;
    const remainingParams = { ...pathParams };

    // Tìm và thay thế các path params (:param)
    const pathParamsMatches = url.match(/:(\w+)/g);
    if(pathParamsMatches) {
        pathParamsMatches.forEach(match => {
            const paramName = match.substring(1); // Bỏ dấu :
            if (remainingParams[paramName] !== undefined) {
                finalUrl = finalUrl.replace(match, remainingParams[paramName]);
                delete remainingParams[paramName];
            }
        });
    }

    return { finalUrl, remainingParams };
}

/**
 * Đăng ký một endpoint GET
 * @param {string} name Tên request
 * @param {string} url URL endpoint
 * @param {'no-cache'=} mode Nếu là 'no-cache' thì luôn fetch lại
 */
const registerGetEndpoint = (name, url, mode) => {
    Object.defineProperty(requestHandlers, name, {
        value: async (params) => {
            return await syncData(
                async () => {
                    const headers = new Headers();
                    interceptors.before && await interceptors.before({ params, headers, type: 'GET' })
                    const { finalUrl, remainingParams } = buildUrlWithPathParams(url, params);
                    const searchParams = new URLSearchParams(remainingParams);
                    const queryString = searchParams.toString() ? '?' + searchParams.toString() : '';
                    return await fetch(finalUrl + queryString, {
                        headers,
                    });
                },
                name,
                mode === 'no-cache' ? false : Object.values(params || {})
            );
        },
        writable: false,
    });
};

/**
 * Đăng ký một endpoint POST
 * @param {string} name Tên request
 * @param {string} url URL endpoint có thể chứa path params như /api/x/:id
 */
const registerPostEndpoint = (name, url) => {
    Object.defineProperty(requestHandlers, name, {
        value: async (body, params) => {

            return await syncData(
                async () => {
                    const headers = new Headers();
                    interceptors.before && await interceptors.before({ body, params, headers, type: 'POST' })
                    const { finalUrl, remainingParams } = buildUrlWithPathParams(url, params);
                    const searchParams = new URLSearchParams(remainingParams);
                    const queryString = searchParams.toString() ? '?' + searchParams.toString() : '';
                     const completeUrl = finalUrl + queryString;

                    if (body instanceof FormData) {
                        return await fetch(completeUrl, {
                            method: 'POST',
                            body: body,
                            headers,
                        });
                    }
                    headers.append('Accept', 'application/json')
                    headers.append('Content-Type', 'application/json')
                    return fetch(completeUrl, {
                        method: 'POST',
                        body: JSON.stringify(body),
                        headers
                    });
                },
                name,
                false
            );
        },
        writable: false,
    });
};

/**
 * Đăng ký một endpoint PATCH
 * @param {string} name Tên request
 * @param {string} url URL endpoint có thể chứa path params như /api/x/:id
 */
const registerPatchEndpoint = (name, url) => {
    Object.defineProperty(requestHandlers, name, {
        value: async (body, params) => {
            return await syncData(
                async () => {
                    const { finalUrl, remainingParams } = buildUrlWithPathParams(url, params);
                    const headers = new Headers();
                    interceptors.before && await interceptors.before({ body, params, headers, type: 'PATCH' })
                    const searchParams = new URLSearchParams(remainingParams);
                    const queryString = searchParams.toString() ? '?' + searchParams.toString() : '';
                    const completeUrl = finalUrl + queryString;

                    if (body instanceof FormData) {
                        return await fetch(completeUrl, {
                            method: 'PATCH',
                            body: body,
                            headers,
                        });
                    }
                    headers.append('Accept', 'application/json')
                    headers.append('Content-Type', 'application/json')
                    return fetch(completeUrl, {
                        method: 'PATCH',
                        body: JSON.stringify(body),
                        headers
                    });
                },
                name,
                false // PATCH thường không cache vì là mutation
            );
        },
        writable: false,
    });
};

/**
 * Đăng ký một endpoint DELETE
 * @param {string} name Tên request
 * @param {string} url URL endpoint có thể chứa path params như /api/x/:id
 */
const registerDeleteEndpoint = (name, url) => {
    Object.defineProperty(requestHandlers, name, {
        value: async (params) => {
            return await syncData(
                async () => {
                    const { finalUrl, remainingParams } = buildUrlWithPathParams(url, params);
                    const headers = new Headers();
                    interceptors.before && await interceptors.before({ params, headers, type: 'DELETE' })
                    const searchParams = new URLSearchParams(remainingParams);
                    const queryString = searchParams.toString() ? '?' + searchParams.toString() : '';
                    const completeUrl = finalUrl + queryString;

                    return await fetch(completeUrl, {
                        method: 'DELETE',
                        headers,
                    });
                },
                name,
                false // DELETE thường không cache vì là mutation
            );
        },
        writable: false,
    });
};

/**
 * Đăng ký một endpoint PUT
 * @param {string} name Tên request
 * @param {string} url URL endpoint có thể chứa path params như /api/x/:id
 */
const registerPutEndpoint = (name, url) => {
    Object.defineProperty(requestHandlers, name, {
        value: async (body, params) => {
            return await syncData(
                async () => {
                    const { finalUrl, remainingParams } = buildUrlWithPathParams(url, params);
                    const headers = new Headers();
                    interceptors.before && await interceptors.before({ body, params, headers, type: 'PUT' })
                    const searchParams = new URLSearchParams(remainingParams);
                    const queryString = searchParams.toString() ? '?' + searchParams.toString() : '';
                    const completeUrl = finalUrl + queryString;

                    if (body instanceof FormData) {
                        return await fetch(completeUrl, {
                            method: 'PUT',
                            body: body,
                            headers,
                        });
                    }
                    headers.append('Accept', 'application/json')
                    headers.append('Content-Type', 'application/json')
                    return fetch(completeUrl, {
                        method: 'PUT',
                        body: JSON.stringify(body),
                        headers
                    });
                },
                name,
                false // PUT thường không cache vì là mutation
            );
        },
        writable: false,
    });
};

export {
    registerGetEndpoint,
    registerPostEndpoint,
    registerPatchEndpoint,
    registerPutEndpoint,
    registerDeleteEndpoint,
    setLoadingHooks,
    setResponseOperator,
    dataStore,
    paramCache,
    messageState,
    hasError,
    requestHandlers,
    loadingHooks,
    interceptors
}