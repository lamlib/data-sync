# DataSync Library

Thư viện JavaScript nhẹ và mạnh mẽ để quản lý đồng bộ dữ liệu với server, tích hợp cache thông minh và loading states.

## ✨ Tính năng chính

- 🚀 **Cache thông minh**: Tự động cache parameters để tránh request trùng lặp
- 🔄 **Loading states**: Quản lý trạng thái loading với hooks tùy chỉnh và debounce 600ms
- 📝 **Message handling**: Xử lý thông báo lỗi và thành công
- 🔌 **Interceptors**: Middleware cho request/response với Headers tùy chỉnh
- 🌐 **RESTful**: Hỗ trợ đầy đủ GET, POST, PUT, PATCH và DELETE
- 📦 **Path params**: Hỗ trợ URL có path parameters (/api/users/:id)
- 🎯 **FormData**: Tự động xử lý cả JSON và FormData payloads

## 🚀 Cài đặt

```bash
# Copy file vào project của bạn
# Import ES6 module
import { registerGetEndpoint } from './main.js'
```

## 💡 Sử dụng cơ bản

### 1. Đăng ký endpoints

```javascript
import { 
    registerGetEndpoint,
    registerPostEndpoint,
    registerPutEndpoint,
    registerPatchEndpoint,
    registerDeleteEndpoint,
    requestHandlers 
} from './main.js';

// Đăng ký GET endpoint với path params
registerGetEndpoint('getUser', '/api/users/:id');
registerGetEndpoint('searchUsers', '/api/users/search', 'no-cache');

// Đăng ký POST endpoint với FormData support
registerPostEndpoint('createUser', '/api/users');
registerPostEndpoint('uploadAvatar', '/api/users/:id/avatar');

// PUT, PATCH và DELETE endpoints
registerPutEndpoint('replaceUser', '/api/users/:id');
registerPatchEndpoint('updateUser', '/api/users/:id'); 
registerDeleteEndpoint('deleteUser', '/api/users/:id');
```

### 2. Gọi API

```javascript
// GET request với path params và query params 
const user = await requestHandlers.getUser({ 
    id: 123,          // path param (:id)
    fields: 'name,email'  // query param
});

// GET request no-cache (luôn fetch mới)
const searchResults = await requestHandlers.searchUsers({ 
    q: 'john' 
});

// POST request với JSON body
const newUser = await requestHandlers.createUser({
    name: 'John Doe',
    email: 'john@example.com'
});

// POST request với FormData và path params
const formData = new FormData();
formData.append('avatar', file);
await requestHandlers.uploadAvatar(formData, { id: 123 });

// PUT vs PATCH request (thay thế vs cập nhật một phần)
await requestHandlers.replaceUser({
    name: 'John Smith',
    email: 'john.smith@example.com'
}, { id: 123 });

await requestHandlers.updateUser({
    name: 'John Smith'
}, { id: 123 });

// DELETE request với path param
await requestHandlers.deleteUser({ id: 123 });
```

### 3. Thiết lập Loading Hooks

```javascript
import { setLoadingHooks } from './datasync.js';

setLoadingHooks({
    onQueueAdd: () => {
        // Hiển thị loading spinner
        document.getElementById('loading').style.display = 'block';
    },
    onQueueEmpty: () => {
        // Ẩn loading spinner  
        document.getElementById('loading').style.display = 'none';
    }
});
```

### 4. Xử lý Message States

```javascript
import { messageState, hasError } from './datasync.js';

// Kiểm tra lỗi sau khi gọi API
await requestHandlers.getUsers();

if (hasError()) {
    console.error('Có lỗi:', messageState.error.message);
} else if (messageState.success) {
    console.log('Thành công:', messageState.success);
}
```

### 5. Interceptors

```javascript
import { interceptors } from './main.js';

// Interceptor trước khi gửi request
interceptors.before = async ({ params, body, headers, type }) => {
    // Thêm authorization header
    const token = localStorage.getItem('token');
    if (token) {
        headers.append('Authorization', `Bearer ${token}`);
    }

    // Thay đổi header cho từng loại request
    if (type === 'POST' || type === 'PUT' || type === 'PATCH') {
        if (!(body instanceof FormData)) {
            headers.append('Content-Type', 'application/json');
        }
    }
    
    console.log(`${type} request:`, { params, body });
};

// Interceptor sau khi nhận response
interceptors.after = (result) => {
    console.log('Response received:', result);
    
    // Xử lý token mới
    if (result.newToken) {
        localStorage.setItem('token', result.newToken);
    }

    // Xử lý refresh token
    if (result.code === 'TOKEN_EXPIRED') {
        // Refresh token logic
    }
};
```

## 📚 API Reference 

### Core Functions

#### `registerGetEndpoint(name, url, mode?)`
Đăng ký một GET endpoint.

- `name`: Tên unique cho endpoint
- `url`: URL của API endpoint, có thể chứa path params (ví dụ: `/api/users/:id`)
- `mode`: `'no-cache'` để disable cache (optional)

#### `registerPostEndpoint(name, url)`
Đăng ký một POST endpoint.

- `name`: Tên unique cho endpoint  
- `url`: URL của API endpoint, hỗ trợ cả JSON body và FormData

#### `registerPutEndpoint(name, url)`
Đăng ký một PUT endpoint để thay thế hoàn toàn resource.

- `name`: Tên unique cho endpoint
- `url`: URL của API endpoint

#### `registerPatchEndpoint(name, url)`
Đăng ký một PATCH endpoint để cập nhật một phần resource.

- `name`: Tên unique cho endpoint
- `url`: URL của API endpoint

#### `registerDeleteEndpoint(name, url)`  
Đăng ký một DELETE endpoint.

- `name`: Tên unique cho endpoint
- `url`: URL của API endpoint

#### `setLoadingHooks({ onQueueAdd, onQueueEmpty })`
Thiết lập callbacks cho loading states với debounce 600ms.

- `onQueueAdd`: Callback khi có request mới
- `onQueueEmpty`: Callback khi hết request

### Data Stores

#### `dataStore` 
Map chứa dữ liệu sau khi sync từ server.

```javascript
import { dataStore } from './main.js';

// Lấy dữ liệu đã cache
const cachedUsers = dataStore.get('getUsers');
```

#### `messageState`
Object chứa trạng thái message.

```javascript
const { error, success } = messageState;
```

#### `paramCache`
Map chứa cache của parameters để tránh duplicate requests cho GET requests.

### Request Handlers

#### `requestHandlers[name](params)`
GET và DELETE requests nhận một object params:
- Path params sẽ thay thế vào URL (ví dụ: `:id`)
- Các params còn lại sẽ trở thành query string

#### `requestHandlers[name](body, params)`
POST, PUT và PATCH requests nhận:
- body: JSON object hoặc FormData instance
- params: Object chứa path params và query params

### Utility Functions

#### `hasError()`
Kiểm tra có lỗi xảy ra không.

```javascript
if (hasError()) {
    // Xử lý lỗi
}
```

#### `interceptors`
Object chứa các interceptors:
- `before`: Chạy trước khi gửi request, có thể modify headers
- `after`: Chạy sau khi nhận response, xử lý kết quả chung
```

## 🎯 Các tình huống sử dụng

### React Integration

```javascript
import { useEffect, useState } from 'react';
import { requestHandlers, setLoadingHooks, messageState } from './datasync.js';

function UserList() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoadingHooks({
            onQueueAdd: () => setLoading(true),
            onQueueEmpty: () => setLoading(false)
        });

        loadUsers();
    }, []);

    const loadUsers = async () => {
        const data = await requestHandlers.getUsers();
        if (data) setUsers(data);
    };

    return (
        <div>
            {loading && <div>Loading...</div>}
            {messageState.error && <div>Error: {messageState.error.message}</div>}
            {users.map(user => <div key={user.id}>{user.name}</div>)}
        </div>
    );
}
```

### Vanilla JavaScript

```javascript
// Khởi tạo
registerGetEndpoint('getProducts', '/api/products');
setLoadingHooks({
    onQueueAdd: () => showSpinner(),
    onQueueEmpty: () => hideSpinner()
});

// Sử dụng
document.getElementById('loadBtn').addEventListener('click', async () => {
    const products = await requestHandlers.getProducts({ category: 'electronics' });
    renderProducts(products);
});
```

## ⚙️ Configuration

### Response Format
Library mong đợi response có format:

```javascript
// Success response
{
    "code": "SUCCESS",  // hoặc không có code
    "data": [...],      // hoặc "result": [...]
    "message": "Optional success message"
}

// Error response  
{
    "code": "ERROR",    // hoặc bất kỳ code nào khác SUCCESS
    "message": "Error description",
    "result": false     // hoặc status code không phải 2xx
}
```

### Request Handling
- Loading spinner hiển thị sau 600ms để tránh flash
- Tự động xử lý Content-Type cho JSON và FormData
- Tự động parse response.json()
- Tự động xử lý path params trong URL
- Cache chỉ áp dụng cho GET requests có mode !== 'no-cache'

### Path Parameters
```javascript
// URL: /api/users/:id/posts/:postId
registerGetEndpoint('getPost', '/api/users/:id/posts/:postId');

// Gọi API:
const post = await requestHandlers.getPost({
    id: 123,        // -> thay thế :id
    postId: 456,    // -> thay thế :postId
    fields: 'title,content'  // -> trở thành query param
});

// -> GET /api/users/123/posts/456?fields=title,content
```

## 🔧 Advanced Usage

### Error Handling

```javascript
import { messageState, hasError } from './main.js';

// Sử dụng try-catch
try {
    await requestHandlers.createUser(userData);
    if (messageState.success) {
        showNotification(messageState.success);
    }
} catch (error) {
    console.error(error);
}

// Hoặc kiểm tra sau khi gọi
const result = await requestHandlers.createUser(userData);
if (hasError()) {
    console.error(messageState.error);
} else {
    console.log('Success:', result);
}
```

### Custom Headers & Auth

```javascript
import { interceptors } from './main.js';

// Thêm auth và custom headers
interceptors.before = async ({ headers, type }) => {
    // Auth header
    const token = localStorage.getItem('token');
    if (token) {
        headers.append('Authorization', `Bearer ${token}`);
    }

    // Custom header cho từng loại request
    if (type === 'GET') {
        headers.append('X-Custom', 'value');
    }
};

// Refresh token handling
interceptors.after = async (result) => {
    if (result.code === 'TOKEN_EXPIRED') {
        const newToken = await refreshToken();
        localStorage.setItem('token', newToken);
        // Có thể retry request cũ
    }
};
```

### Multiple Environments

```javascript
const API_BASE = process.env.NODE_ENV === 'production' 
    ? 'https://api.example.com' 
    : 'http://localhost:3000';

// Đăng ký endpoint với base URL
const endpoints = {
    getUser: '/api/users/:id',
    createUser: '/api/users',
    // ...
};

Object.entries(endpoints).forEach(([name, path]) => {
    const url = API_BASE + path;
    if (path.includes('/:')) {
        registerGetEndpoint(name, url);
    } else {
        registerPostEndpoint(name, url);
    }
});
```

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

## 📄 License

MIT License - see LICENSE file for details.
