import { expect, test, vi, beforeEach } from "vitest";
import * as datasync from '../src/main';

beforeEach(() => {
    // Reset state before each test
    datasync.dataStore.clear();
    datasync.paramCache.clear();
    
    global.fetch = vi.fn();
    // Reset message state
    Object.assign(datasync.messageState, {
        error: null,
        success: null
    });
    // Reset loading hooks
    Object.assign(datasync.loadingHooks, {
        onQueueAdd: null,
        onQueueEmpty: null
    });
});

test('Apis is define', () => {
    expect(datasync.activeRequestCount).toBeDefined();
    expect(datasync.dataStore).toBeDefined();
    expect(datasync.hasError).toBeDefined();
    expect(datasync.interceptors).toBeDefined();
    expect(datasync.loadingHooks).toBeDefined();
    expect(datasync.messageState).toBeDefined();
    expect(datasync.paramCache).toBeDefined();
    expect(datasync.registerGetEndpoint).toBeDefined();
    expect(datasync.registerPostEndpoint).toBeDefined();
    expect(datasync.requestHandlers).toBeDefined();
    expect(datasync.setLoadingHooks).toBeDefined();
});

test('registerGetEndpoint phải đăng ký được endpoint', () => {
    datasync.registerGetEndpoint('get1', '/api/x');
    expect(datasync.requestHandlers.get1).toBeDefined();
    expect(typeof datasync.requestHandlers.get1).toBe('function');
});

test('registerPostEndpoint phải đăng ký được endpoint', () => {
    datasync.registerGetEndpoint('post2', '/api/x');
    expect(datasync.requestHandlers.post2).toBeDefined();
    expect(typeof datasync.requestHandlers.post2).toBe('function');
});

test('Phải ngăn chặn duplicate khi gọi GET endpoint với tham số lặp lại', async () => {
    global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: [] })
    });

    datasync.registerGetEndpoint('get3', '/api/x');
    await datasync.requestHandlers.get3({ page: 1 });
    await datasync.requestHandlers.get3({ page: 1 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('Phải xử lý lỗi đúng', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid request' })
    });

    datasync.registerGetEndpoint('get4', '/api/x');
    await datasync.requestHandlers.get4({});
    expect(datasync.hasError()).toBe(true);    
    expect(datasync.messageState.error).toBeDefined();
});

test('Interceptors được gọi với đúng parameters', async () => {
    const beforeInterceptor = vi.fn();
    const afterInterceptor = vi.fn();

    datasync.interceptors.before = beforeInterceptor;
    datasync.interceptors.after = afterInterceptor;

    const responseData = { code: 'SUCCESS', data: [] };

    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseData)
    });

    datasync.registerGetEndpoint('get5', '/api/x');

    await datasync.requestHandlers.get5({ page: 1 });

    expect(beforeInterceptor).toHaveBeenCalledWith({
        params: { page: 1 },
        headers: expect.any(Headers),
        type: 'GET'
    });    
    expect(afterInterceptor).toHaveBeenCalledWith(responseData);
});

test('FormData được xử lý trong POST requests', async () => {

    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: { id: 1 } })
    });

    const formData = new FormData();

    formData.append('file', new Blob(['test file content']), 'test.txt');
    formData.append('name', 'Test User');

    datasync.registerPostEndpoint('post6', '/api/x');
    await datasync.requestHandlers.post6(formData);

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/x',
        expect.objectContaining({
            method: 'POST',
            body: formData,
            headers: expect.any(Headers)
        })
    );
});

test('GET request khi truyền tham số vào phải có URL với query string', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: [] })
    });    
    datasync.registerGetEndpoint('get7', '/api/x');
    await datasync.requestHandlers.get7({ page: 1, limit: 10 });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/x?page=1&limit=10',
        expect.any(Object)
    );
});

test('POST request gửi đúng body', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: { id: 1 } })
    });

    const data = { name: 'Test User', email: 'test@example.com' };

    datasync.registerPostEndpoint('post8', '/api/x');
    await datasync.requestHandlers.post8(data);

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/x',
        expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(data),
            headers: expect.any(Headers)
        })
    );
});