# Xóa profile

API URL

```
GET: /api/v3/profiles/delete/{profile_id}
```

Param

| Param | Mô tả                                                                                                                   |
| ----- | ----------------------------------------------------------------------------------------------------------------------- |
| mode  | <p>1 - chỉ xóa ở database, 2 - xóa cả database và nơi lưu trữ<br><br>eg: /api/v3/profiles/delete/123-456-789?mode=2</p> |

Repsonse

```json
{
    "success": true,
    "data": null,
    "message": "Xóa thành công"
}
```
