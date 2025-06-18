# DataSync Library

Thư viện JavaScript nhẹ và mạnh mẽ để quản lý đồng bộ dữ liệu với server, tích hợp cache thông minh và loading states.

## ✨ Tính năng chính

- 🚀 **Cache thông minh**: Tự động cache parameters để tránh request trùng lặp
- 🔄 **Loading states**: Quản lý trạng thái loading với hooks tùy chỉnh
- 📝 **Message handling**: Xử lý thông báo lỗi và thành công
- 🔌 **Interceptors**: Middleware cho request/response
- 🌐 **RESTful**: Hỗ trợ cả GET và POST endpoints
- 📦 **No-cache mode**: Linh hoạt với mode cache hoặc no-cache

## 🚀 Cài đặt

```bash
# Copy file vào project của bạn
# Import ES6 module
```

## 💡 Sử dụng cơ bản

### 1. Đăng ký endpoints

```javascript
import { 
    registerGetEndpoint, 
    registerPostEndpoint, 
    requestHandlers 
} from './datasync.js';

// Đăng ký GET endpoint
registerGetEndpoint('getUsers', '/api/users');
registerGetEndpoint('searchUsers', '/api/users/search', 'no-cache');

// Đăng ký POST endpoint  
registerPostEndpoint('createUser', '/api/users');
registerPostEndpoint('updateUser', '/api/users');
```

### 2. Gọi API

```javascript
// GET request với parameters
const users = await requestHandlers.getUsers({ 
    page: 1, 
    limit: 10 
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

// POST request với FormData
const formData = new FormData();
formData.append('avatar', file);
await requestHandlers.updateUser(formData, { id: 123 });
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
import { interceptors } from './datasync.js';

// Interceptor trước khi gửi request
interceptors.before = async ({ params, body, headers, type }) => {
    // Thêm authorization header
    const token = localStorage.getItem('token');
    if (token) {
        headers.append('Authorization', `Bearer ${token}`);
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
};
```

## 📚 API Reference

### Core Functions

#### `registerGetEndpoint(name, url, mode?)`
Đăng ký một GET endpoint.

- `name`: Tên unique cho endpoint
- `url`: URL của API endpoint  
- `mode`: `'no-cache'` để disable cache (optional)

#### `registerPostEndpoint(name, url)`
Đăng ký một POST endpoint.

- `name`: Tên unique cho endpoint
- `url`: URL của API endpoint

#### `setLoadingHooks({ onQueueAdd, onQueueEmpty })`
Thiết lập callbacks cho loading states.

- `onQueueAdd`: Callback khi có request mới
- `onQueueEmpty`: Callback khi hết request

### Data Stores

#### `dataStore`
Map chứa dữ liệu sau khi sync từ server.

```javascript
import { dataStore } from './datasync.js';

// Lấy dữ liệu đã cache
const cachedUsers = dataStore.get('getUsers');
```

#### `messageState`
Object chứa trạng thái message.

```javascript
const { error, success } = messageState;
```

#### `paramCache`
Map chứa cache của parameters để tránh duplicate requests.

### Utility Functions

#### `hasError()`
Kiểm tra có lỗi hay không.

```javascript
if (hasError()) {
    // Xử lý lỗi
}
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
    "code": "SUCCESS",
    "data": [...], // hoặc "result": [...]
    "message": "Optional success message"
}

// Error response  
{
    "code": "ERROR",
    "message": "Error description"
}
```

### Request Timeout
Loading spinner sẽ hiển thị sau 600ms để tránh flash.

```javascript
const timeout = 600; // ms
```

## 🔧 Advanced Usage

### Custom Error Handling

```javascript
import { syncData } from './datasync.js';

// Custom sync function
const customSync = async () => {
    try {
        const data = await requestHandlers.getUsers();
        return data;
    } catch (error) {
        // Custom error handling
        showNotification('Failed to load users', 'error');
        throw error;
    }
};
```

### Multiple Environments

```javascript
const API_BASE = process.env.NODE_ENV === 'production' 
    ? 'https://api.example.com' 
    : 'http://localhost:3000';

registerGetEndpoint('getUsers', `${API_BASE}/users`);
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes  
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - see LICENSE file for details.
