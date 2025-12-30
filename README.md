# @lamlib/data-sync

A lightweight client-side data synchronization library built on the Fetch API. Simplify your HTTP requests with endpoint registration, automatic caching, loading state management, and request interceptors.

## Installation

```bash
npm install @lamlib/data-sync
```

## Quick Start

```javascript
import {
  registerGetEndpoint,
  registerPostEndpoint,
  requestHandlers,
  setLoadingHooks
} from '@lamlib/data-sync';

// 1. Set up loading hooks (optional)
setLoadingHooks({
  onQueueAdd: () => showSpinner(),
  onQueueEmpty: () => hideSpinner()
});

// 2. Register your endpoints
registerGetEndpoint('getUsers', '/api/users');
registerPostEndpoint('createUser', '/api/users');

// 3. Make requests
const users = await requestHandlers.getUsers();
const newUser = await requestHandlers.createUser({ name: 'John', email: 'john@example.com' });
```

## Features

- **Endpoint Registration** - Register GET, POST, PUT, PATCH, DELETE endpoints once, use anywhere
- **Automatic Caching** - GET requests are cached based on parameters to avoid duplicate calls
- **Path Parameters** - Support for dynamic URL segments (e.g., `/api/users/:id`)
- **Loading State Management** - Built-in hooks for handling loading UI states
- **Request Interceptors** - Modify requests before they're sent and handle responses
- **FormData Support** - Automatic handling of FormData for file uploads
- **Error Handling** - Centralized error catching and message state management

## API Reference

### Endpoint Registration

#### `registerGetEndpoint(name, url, mode?)`

Register a GET endpoint.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Unique identifier for the endpoint |
| `url` | `string` | URL endpoint (supports path params like `/api/users/:id`) |
| `mode` | `'no-cache'` | Optional. If set, bypasses caching |

```javascript
// Basic usage
registerGetEndpoint('getUsers', '/api/users');

// With path parameters
registerGetEndpoint('getUser', '/api/users/:id');

// Without caching
registerGetEndpoint('getLatestData', '/api/data', 'no-cache');

// Call the endpoint
const users = await requestHandlers.getUsers();
const user = await requestHandlers.getUser({ id: 123 });
const data = await requestHandlers.getLatestData({ filter: 'active' });
```

#### `registerPostEndpoint(name, url)`

Register a POST endpoint.

**Signature:** `requestHandlers.name(body, params)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `body` | `object \| FormData` | Request body (JSON or FormData) |
| `params` | `object` | Optional. Path params and query params |

```javascript
registerPostEndpoint('createUser', '/api/users');
registerPostEndpoint('updateUserStatus', '/api/users/:id/status');
registerPostEndpoint('addComment', '/api/posts/:postId/comments');

// 1. Call with body only
await requestHandlers.createUser({ name: 'John', email: 'john@example.com' });

// 2. Call with body + path params
// URL: /api/users/123/status
await requestHandlers.updateUserStatus(
  { status: 'active' },           // body - sent as JSON
  { id: 123 }                     // params - :id becomes path param
);

// 3. Call with body + path params + query params
// URL: /api/posts/456/comments?notify=true&lang=en
await requestHandlers.addComment(
  { content: 'Great post!' },     // body - sent as JSON
  {
    postId: 456,                  // path param - replaces :postId
    notify: true,                 // query param - added to URL
    lang: 'en'                    // query param - added to URL
  }
);

// 4. Call with FormData for file uploads
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('description', 'My photo');
await requestHandlers.createUser(formData);

// 5. FormData with path params
// URL: /api/posts/789/comments
const formData2 = new FormData();
formData2.append('image', imageFile);
await requestHandlers.addComment(formData2, { postId: 789 });
```

**How params work:**
- Path params (e.g., `:id`, `:postId`) are replaced in the URL
- Remaining params are converted to query string
- Example: `{ postId: 456, notify: true }` with URL `/api/posts/:postId/comments`
  - `:postId` → `456` (path param)
  - `notify=true` → query string

#### `registerPutEndpoint(name, url)`

Register a PUT endpoint.

```javascript
registerPutEndpoint('updateUser', '/api/users/:id');

await requestHandlers.updateUser(
  { name: 'John Doe', email: 'john.doe@example.com' },
  { id: 123 }
);
```

#### `registerPatchEndpoint(name, url)`

Register a PATCH endpoint.

```javascript
registerPatchEndpoint('patchUser', '/api/users/:id');

await requestHandlers.patchUser({ name: 'Jane' }, { id: 123 });
```

#### `registerDeleteEndpoint(name, url)`

Register a DELETE endpoint.

```javascript
registerDeleteEndpoint('deleteUser', '/api/users/:id');

await requestHandlers.deleteUser({ id: 123 });
```

---

### Loading Hooks

#### `setLoadingHooks({ onQueueAdd, onQueueEmpty })`

Set callbacks for loading state management. Loading UI is triggered after a 600ms delay to avoid flickering on fast requests.

```javascript
setLoadingHooks({
  onQueueAdd: () => {
    document.getElementById('spinner').style.display = 'block';
  },
  onQueueEmpty: () => {
    document.getElementById('spinner').style.display = 'none';
  }
});
```

---

### Response Operators

#### `setResponseOperator({ picker, errCatcher })`

Customize how responses are processed.

| Parameter | Type | Description |
|-----------|------|-------------|
| `picker` | `(result) => any` | Extract data from response |
| `errCatcher` | `(response, result) => void` | Handle errors (throw to trigger error state) |

```javascript
import { setResponseOperator } from '@lamlib/data-sync';

setResponseOperator({
  // Custom data extraction
  picker: (result) => result.payload,

  // Custom error handling
  errCatcher: (response, result) => {
    if (!response.ok || result.error) {
      throw new Error(result.error?.message || 'Request failed');
    }
  }
});
```

**Default behavior:**
- `picker`: Returns `result.data` or `result.result`
- `errCatcher`: Throws error if `result.code !== 'SUCCESS'`, `result.result === false`, or `!response.ok`

#### `resetResponseOperator()`

Reset response operators to default behavior.

```javascript
import { resetResponseOperator } from '@lamlib/data-sync';

resetResponseOperator();
```

---

### Interceptors

#### `interceptors.before`

Execute logic before each request. Useful for adding authentication headers.

```javascript
import { interceptors } from '@lamlib/data-sync';

interceptors.before = async ({ params, body, headers, type }) => {
  // Add auth token to all requests
  const token = localStorage.getItem('token');
  if (token) {
    headers.append('Authorization', `Bearer ${token}`);
  }

  // Log request type
  console.log(`Making ${type} request`);
};
```

#### `interceptors.after`

Execute logic after each successful response.

```javascript
interceptors.after = (result) => {
  // Log all responses
  console.log('Response received:', result);

  // Handle token refresh
  if (result.newToken) {
    localStorage.setItem('token', result.newToken);
  }
};
```

---

### State Management

#### `dataStore`

A `Map` containing synced data from the server, keyed by endpoint name.

```javascript
import { dataStore, requestHandlers } from '@lamlib/data-sync';

await requestHandlers.getUsers();
const users = dataStore.get('getUsers');
```

#### `paramCache`

A `Map` containing cached parameters to prevent duplicate requests.

```javascript
import { paramCache } from '@lamlib/data-sync';

// Check cached params for an endpoint
const cachedParams = paramCache.get('getUsers');
```

#### `messageState`

Object containing error and success messages from the last request.

```javascript
import { messageState, requestHandlers } from '@lamlib/data-sync';

await requestHandlers.createUser({ name: 'John' });

if (messageState.error) {
  console.error('Error:', messageState.error.message);
} else if (messageState.success) {
  console.log('Success:', messageState.success);
}
```

#### `hasError()`

Check if an error occurred in the last request.

```javascript
import { hasError, messageState } from '@lamlib/data-sync';

await requestHandlers.createUser({ name: 'John' });

if (hasError()) {
  alert(messageState.error.message);
}
```

---

## Complete Example

```javascript
import {
  registerGetEndpoint,
  registerPostEndpoint,
  registerPutEndpoint,
  registerDeleteEndpoint,
  setLoadingHooks,
  setResponseOperator,
  interceptors,
  requestHandlers,
  messageState,
  hasError
} from '@lamlib/data-sync';

// Configure loading UI
setLoadingHooks({
  onQueueAdd: () => document.body.classList.add('loading'),
  onQueueEmpty: () => document.body.classList.remove('loading')
});

// Configure response handling for your API format
setResponseOperator({
  picker: (result) => result.data,
  errCatcher: (response, result) => {
    if (!response.ok) throw new Error(result.message || 'Request failed');
  }
});

// Add authentication to all requests
interceptors.before = async ({ headers }) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    headers.append('Authorization', `Bearer ${token}`);
  }
};

// Register all endpoints
registerGetEndpoint('getUsers', '/api/users');
registerGetEndpoint('getUser', '/api/users/:id');
registerPostEndpoint('createUser', '/api/users');
registerPutEndpoint('updateUser', '/api/users/:id');
registerDeleteEndpoint('deleteUser', '/api/users/:id');

// Usage in your application
async function loadUsers() {
  const users = await requestHandlers.getUsers();
  if (!hasError()) {
    renderUserList(users);
  }
}

async function createUser(userData) {
  await requestHandlers.createUser(userData);
  if (hasError()) {
    showError(messageState.error.message);
  } else {
    showSuccess(messageState.success);
    loadUsers(); // Refresh list
  }
}

async function updateUser(id, userData) {
  await requestHandlers.updateUser(userData, { id });
  if (!hasError()) {
    loadUsers();
  }
}

async function deleteUser(id) {
  await requestHandlers.deleteUser({ id });
  if (!hasError()) {
    loadUsers();
  }
}
```

## License

ISC
