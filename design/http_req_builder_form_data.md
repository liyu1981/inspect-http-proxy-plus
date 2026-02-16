# Design: HTTP Request Builder Form-Data & File Upload Support

This document outlines the plan to upgrade the HTTP Request Builder in the UI to support `multipart/form-data` and file uploads, along with the necessary backend changes.

## 1. Frontend Changes

### 1.1 State Management (Jotai)
Update `frontend/src/app/_jotai/http-req.ts` to include:
- `bodyType`: An enum-like string atom: `"json" | "form-data" | "raw"`.
- `formDataEntries`: An array of objects for form-data:
  ```typescript
  interface FormDataEntry {
    id: string;
    key: string;
    value: string | File;
    type: "text" | "file";
    enabled: boolean;
  }
  ```
- Update `RequestData` and `DEFAULT_REQUEST` to support these new fields.

### 1.2 UI Components (React)
Update `frontend/src/app/_components/http-req-builder.tsx`:
- Add a **Body Type Selector** (Tabs or Radio buttons) to switch between JSON, Form-Data, and Raw body types.
- **Form-Data Editor**:
  - A table-like interface similar to the Headers section.
  - Each row has a key, a value, and a type toggle (Text vs. File).
  - For "File" type, show a file picker or the name of the selected file with a "Change" button.
- **Integration**:
  - JSON type continues to use `JsonEditor`.
  - Raw type uses a simple `Textarea`.
  - Form-Data type uses the new `FormDataEditor`.

### 1.3 Request Execution
Update the `sendRequest` function:
- If `bodyType` is `form-data`:
  - Create a `FormData` object.
  - Append all enabled entries to it.
  - When using `api.post("/api/httpreq", formData)`, ensure the correct headers are set (Axios/Fetch usually handles `multipart/form-data` automatically when passed a `FormData` object).
  - *Note*: Since the backend currently expects a JSON payload for `/api/httpreq`, we have two options:
    1. Update the backend to accept `multipart/form-data` at the same endpoint.
    2. Encode files to Base64 and send as JSON (less efficient).
  - **Proposed**: Update the backend to handle `multipart/form-data`.

## 2. Backend Changes

### 2.1 API Handler Update
Update `pkg/web/api/api_httpreq.go`:
- Refactor `handleHttpReq` to detect the `Content-Type` of the incoming request from the UI.
- If `multipart/form-data`:
  - Use `r.ParseMultipartForm()` to extract fields and files.
  - Reconstruct the outgoing request as a multipart request if files are present.
  - Handle both simple form fields and uploaded files.
- If `application/json`:
  - Continue using the existing logic for JSON/Raw bodies.

### 2.2 Request Proxying Logic
- Ensure the backend `http.Client` correctly proxies the multipart body to the target URL.
- Use `io.Pipe` and `multipart.Writer` to efficiently stream the multipart body to the target.

## 3. Data Persistence
- The `proxy_sessions` table already stores `RequestBody` as a `BLOB`, which can store the raw multipart data.
- Ensure `RequestBodySize` and `RequestContentType` are correctly populated.

## 4. Implementation Steps
1.  **Backend**: Update `handleHttpReq` to support `multipart/form-data` input.
2.  **Frontend (State)**: Update Jotai atoms to support `bodyType` and `formDataEntries`.
3.  **Frontend (UI)**: Add body type selector and `FormDataEditor`.
4.  **Frontend (Logic)**: Update `sendRequest` to handle `FormData` objects.
5.  **Testing**: Verify with various APIs (JSON-based, Form-based, and File upload endpoints).
