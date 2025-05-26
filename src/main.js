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
        if (params !== false) {
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
        const response = await fetchFn();
        clearTimeout(timeoutId);

        const result = await response.json();

        if (result.code && result.code !== 'SUCCESS') throw result.message;
        if (result.result === false) throw result.message;

        const data = result.data || result.result;
        dataStore.set(key, data);

        if (result.message) messageState.success = result.message;
        return data;
    } catch (err) {
        messageState.error = err;
        alert(err);
    } finally {
        if (activeRequestCount > 0) activeRequestCount--;
        if (activeRequestCount === 0) {
            loadingHooks.onQueueEmpty && loadingHooks.onQueueEmpty();
        }
    }
};

const requestHandlers = {};

/**
 * Đăng ký một endpoint GET
 * @param {string} name Tên request
 * @param {string} url URL endpoint
 * @param {'no-cache'=} mode Nếu là 'no-cache' thì luôn fetch lại
 */
const registerGetEndpoint = (name, url, mode) => {
    Object.defineProperty(requestHandlers, name, {
        value: async (params) => {
            const searchParams = new URLSearchParams(params);
            const queryString = searchParams.toString() ? '?' + searchParams.toString() : '';
            return await syncData(
                () => fetch(url + queryString),
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
 * @param {string} url URL endpoint
 */
const registerPostEndpoint = (name, url) => {
    const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
    };

    Object.defineProperty(requestHandlers, name, {
        value: async (body, params) => {
            const searchParams = new URLSearchParams(params);
            const queryString = searchParams.toString() ? '?' + searchParams.toString() : '';
            const finalUrl = url + queryString;

            return await syncData(
                () => {
                    if (body instanceof FormData) {
                        return fetch(finalUrl, {
                            method: 'POST',
                            body: body
                        });
                    }
                    return fetch(finalUrl, {
                        method: 'POST',
                        body: JSON.stringify(body),
                        headers
                    });
                },
                name
            );
        },
        writable: false,
    });
};

export {
    registerGetEndpoint,
    registerPostEndpoint,
    setLoadingHooks,
    dataStore,
    paramCache,
    messageState,
    hasError,
    requestHandlers,
    activeRequestCount,
    loadingHooks,
}