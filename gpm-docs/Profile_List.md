# Danh sách profiles

API URL

```
GET: /api/v3/profiles
```

Params

<table><thead><tr><th width="160">Tên param</th><th width="148">Bắt buộc</th><th>Mô tả</th></tr></thead><tbody><tr><td>group_id</td><td>Không</td><td>ID group cần lọc (lấy tại api Danh sách nhóm)</td></tr><tr><td>page</td><td>Không</td><td>Số trang (mặc định 1)</td></tr><tr><td>per_page</td><td>Không</td><td>Số profile mỗi trang (mặc định 50)</td></tr><tr><td>sort</td><td>Không</td><td>0 - Mới nhất, 1 - Cũ tới mới, 2 - Tên A-Z, 3 - Tên Z-A</td></tr><tr><td>search</td><td>Không</td><td>Từ khóa profile name</td></tr></tbody></table>

Ví dụ

```
http://127.0.0.1:19995/api/v3/profiles?group=Ebay&page=1&per_page=100
```

Response

```json
{
    "success": true,
    "data": [
        {
            "id": "ID_OF_PROFILE",
            "name": "NAME_OF_PROFILE",
            "raw_proxy": "RAW_PROXY",
            "browser_type": "chromium / firefox",
            "browser_version": "BROWSER_VERSISON",
            "group_id": "ID_OF_GROUP",
            "profile_path": "Local path or S3",
            "note": "",
            "created_at": "DATE"
        }
    ],
    "pagination": {
        "total": 7,
        "page": 1,
        "page_size": 100,
        "total_page": 1
    },
    "message": "OK"
}
```
