# Lấy thông tin profile

API URL

```
GET: /api/v3/profile/{id}
```

Ví dụ

```
http://127.0.0.1:19995/api/v3/profiles/929e187c-2da7-4ecb-b3dd-9600e211fa4f
```

Response

```json
{
    "success": true,
    "data": {
        "id": "ID_OF_PROFILE",
        "name": "NAME_OF_PROFILE",
        "raw_proxy": "RAW_PROXY",
        "browser_type": "chromium / firefox",
        "browser_version": "BROWSER_VERSISON",
        "group_id": "ID_OF_GROUP",
        "profile_path": "Local path or S3",
        "note": "",
        "created_at": "DATE"
    },
    "message": "OK"
}
```
