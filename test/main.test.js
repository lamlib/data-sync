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

test('PATCH và PUT hoạt động đúng với path params', async () => {
    global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: { id: 1 } })
    });

    // Test PATCH
    const patchData = { status: 'active' };
    datasync.registerPatchEndpoint('patch9', '/api/users/:id/status');
    await datasync.requestHandlers.patch9(patchData, { id: 1, type: 'admin' });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1/status?type=admin',
        expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify(patchData),
            headers: expect.any(Headers)
        })
    );

    // Test PUT
    const putData = { name: 'Updated', email: 'new@example.com' };
    datasync.registerPutEndpoint('put10', '/api/users/:id');
    await datasync.requestHandlers.put10(putData, { id: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify(putData),
            headers: expect.any(Headers)
        })
    );
});

test('DELETE method hoạt động đúng', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: null })
    });

    datasync.registerDeleteEndpoint('delete11', '/api/users/:id');
    await datasync.requestHandlers.delete11({ id: 1, reason: 'inactive' });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1?reason=inactive',
        expect.objectContaining({
            method: 'DELETE',
            headers: expect.any(Headers)
        })
    );
});

test('FormData được xử lý đúng trong các methods', async () => {
    global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: { id: 1 } })
    });

    const formData = new FormData();
    formData.append('file', new Blob(['test']), 'test.txt');

    datasync.registerPutEndpoint('put12', '/api/files/:id');
    await datasync.requestHandlers.put12(formData, { id: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/files/1',
        expect.objectContaining({
            method: 'PUT',
            body: formData,
            headers: expect.any(Headers)
        })
    );
});

test('Path parameters phải được thay thế đúng trong URL', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: { id: 123 } })
    });

    datasync.registerGetEndpoint('get13', '/api/users/:id');
    await datasync.requestHandlers.get13({ id: 123, filter: 'active' });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/123?filter=active',
        expect.any(Object)
    );
});

test('PATCH request gửi đúng method và body', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: { id: 1 } })
    });

    const updateData = { status: 'active' };
    datasync.registerPatchEndpoint('patch14', '/api/users/:id');
    await datasync.requestHandlers.patch14(updateData, { id: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify(updateData),
            headers: expect.any(Headers)
        })
    );
});

test('PUT request gửi đúng method và body', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: { id: 1 } })
    });

    const userData = { name: 'Updated User', email: 'updated@example.com' };
    datasync.registerPutEndpoint('put15', '/api/users/:id');
    await datasync.requestHandlers.put15(userData, { id: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify(userData),
            headers: expect.any(Headers)
        })
    );
});

test('DELETE request gửi đúng method', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: null })
    });

    datasync.registerDeleteEndpoint('delete16', '/api/users/:id');
    await datasync.requestHandlers.delete16({ id: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
            method: 'DELETE',
            headers: expect.any(Headers)
        })
    );
});

test('Các method mutation (PUT, PATCH, DELETE) không sử dụng cache', async () => {
    global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: { id: 1 } })
    });

    // Test PATCH
    datasync.registerPatchEndpoint('patch17', '/api/users/:id');
    await datasync.requestHandlers.patch17({ status: 'active' }, { id: 1 });
    await datasync.requestHandlers.patch17({ status: 'active' }, { id: 1 });

    // Test PUT
    datasync.registerPutEndpoint('put18', '/api/users/:id');
    await datasync.requestHandlers.put18({ name: 'Test' }, { id: 1 });
    await datasync.requestHandlers.put18({ name: 'Test' }, { id: 1 });

    // Test DELETE
    datasync.registerDeleteEndpoint('delete19', '/api/users/:id');
    await datasync.requestHandlers.delete19({ id: 1 });
    await datasync.requestHandlers.delete19({ id: 1 });

    // Mỗi cặp request giống nhau phải tạo ra 2 API calls thực tế
    expect(global.fetch).toHaveBeenCalledTimes(6);
});

test('FormData được xử lý đúng trong PATCH và PUT requests', async () => {
    global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: { id: 1 } })
    });

    const formData = new FormData();
    formData.append('file', new Blob(['test file content']), 'test.txt');
    formData.append('name', 'Test User');

    // Test PATCH với FormData
    datasync.registerPatchEndpoint('patch20', '/api/users/:id');
    await datasync.requestHandlers.patch20(formData, { id: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
            method: 'PATCH',
            body: formData,
            headers: expect.any(Headers)
        })
    );

    // Test PUT với FormData
    datasync.registerPutEndpoint('put21', '/api/users/:id');
    await datasync.requestHandlers.put21(formData, { id: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
            method: 'PUT',
            body: formData,
            headers: expect.any(Headers)
        })
    );
});

test('Path parameters phải được thay thế đúng trong URL', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: { id: 123 } })
    });

    datasync.registerGetEndpoint('get22', '/api/users/:id');
    await datasync.requestHandlers.get22({ id: 123, filter: 'active' });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/123?filter=active',
        expect.any(Object)
    );
});

test('PATCH request gửi đúng method và body', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: { id: 1 } })
    });

    const updateData = { status: 'active' };
    datasync.registerPatchEndpoint('patch23', '/api/users/:id');
    await datasync.requestHandlers.patch23(updateData, { id: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify(updateData),
            headers: expect.any(Headers)
        })
    );
});

test('PUT request gửi đúng method và body', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: { id: 1 } })
    });

    const userData = { name: 'Updated User', email: 'updated@example.com' };
    datasync.registerPutEndpoint('put24', '/api/users/:id');
    await datasync.requestHandlers.put24(userData, { id: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify(userData),
            headers: expect.any(Headers)
        })
    );
});

test('DELETE request gửi đúng method', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: null })
    });

    datasync.registerDeleteEndpoint('delete25', '/api/users/:id');
    await datasync.requestHandlers.delete25({ id: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
            method: 'DELETE',
            headers: expect.any(Headers)
        })
    );
});

test('Các method mutation (PUT, PATCH, DELETE) không sử dụng cache', async () => {
    global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: { id: 1 } })
    });

    // Test PATCH
    datasync.registerPatchEndpoint('patch26', '/api/users/:id');
    await datasync.requestHandlers.patch26({ status: 'active' }, { id: 1 });
    await datasync.requestHandlers.patch26({ status: 'active' }, { id: 1 });

    // Test PUT
    datasync.registerPutEndpoint('put27', '/api/users/:id');
    await datasync.requestHandlers.put27({ name: 'Test' }, { id: 1 });
    await datasync.requestHandlers.put27({ name: 'Test' }, { id: 1 });

    // Test DELETE
    datasync.registerDeleteEndpoint('delete28', '/api/users/:id');
    await datasync.requestHandlers.delete28({ id: 1 });
    await datasync.requestHandlers.delete28({ id: 1 });

    // Mỗi cặp request giống nhau phải tạo ra 2 API calls thực tế
    expect(global.fetch).toHaveBeenCalledTimes(6);
});

test('FormData được xử lý đúng trong PATCH và PUT requests', async () => {
    global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ code: 'SUCCESS', data: { id: 1 } })
    });

    const formData = new FormData();
    formData.append('file', new Blob(['test file content']), 'test.txt');
    formData.append('name', 'Test User');

    // Test PATCH với FormData
    datasync.registerPatchEndpoint('patch29', '/api/users/:id');
    await datasync.requestHandlers.patch29(formData, { id: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
            method: 'PATCH',
            body: formData,
            headers: expect.any(Headers)
        })
    );

    // Test PUT với FormData
    datasync.registerPutEndpoint('put30', '/api/users/:id');
    await datasync.requestHandlers.put30(formData, { id: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
            method: 'PUT',
            body: formData,
            headers: expect.any(Headers)
        })
    );
});