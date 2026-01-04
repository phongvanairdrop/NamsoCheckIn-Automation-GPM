# Cập nhật profile

API URL

```
POST /api/v3/profiles/update/{profile_id}
```

Post data

```json
{
    "profile_name" : "NAME_OF_PROFILE",
    "group_id": 1,
    "raw_proxy" : "",
    "startup_urls": "",
    "note": "",
    "color": "COLOR_HEX",
    "user_agent": "auto",
    "is_noise_canvas": false,
    "is_noise_webgl": false,
    "is_noise_client_rect": false,
    "is_noise_audio_context": true
}
```

Giải thích các thông số:\
Các thông số không bắt buộc hoặc không muốn thay đổi không cần cho vào post data

<table><thead><tr><th width="224">Tên trường</th><th width="134">Bắt buộc</th><th>Mô tả</th></tr></thead><tbody><tr><td>name</td><td>Có</td><td>Tên của profile</td></tr><tr><td>group</td><td>Không</td><td>Tên của group</td></tr><tr><td>raw_proxy</td><td>Không</td><td>HTTP proxy| IP:Port:User:Pass<br>Socks5| socks5://IP:Port:User:Pass<br>TMProxy| tm://API_KEY|True,False<br>TinProxy| tin://API_KEY|True,False<br>TinsoftProxy| tinsoft://API_KEY|True,False</td></tr><tr><td>startup_urls</td><td>Không</td><td>Url 1, Url 2, Url 3</td></tr><tr><td>note</td><td>không</td><td>Ghi chú</td></tr><tr><td>color</td><td>Không</td><td>Mã hex màu profile</td></tr><tr><td>user_agent</td><td>Không</td><td>"auto" hoặc tự điền</td></tr><tr><td>is_noise_canvas</td><td>Không</td><td>Xem chi tiết tại API tạo profile</td></tr><tr><td>is_noise_webgl</td><td>Không</td><td>Xem chi tiết tại API tạo profile</td></tr><tr><td>is_noise_client_rect</td><td>Không</td><td>Xem chi tiết tại API tạo profile</td></tr><tr><td>is_noise_audio_context</td><td>Không</td><td>Xem chi tiết tại API tạo profile</td></tr></tbody></table>

Reponse

```json
{
    "success": true,
    "message": "OK",
    "data": {}
}
```
