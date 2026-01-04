# Tạo profile

API URL

```
POST /api/v3/profiles/create
```

Post data

```json
{
    "profile_name" : "Test profile",
    "group_name": "All",
    "browser_core": "chromium",
    "browser_name": "Chrome",
    "browser_version": "119.0.6045.124",
    "is_random_browser_version": false,
    "raw_proxy" : "",
    "startup_urls": "",
    "is_masked_font": true,
    "is_noise_canvas": false,
    "is_noise_webgl": false,
    "is_noise_client_rect": false,
    "is_noise_audio_context": true,
    "is_random_screen": false,
    "is_masked_webgl_data": true,
    "is_masked_media_device": true,
    "is_masked_font": true,
    "is_random_os": false,
    "os": "Windows 11",
    "webrtc_mode": 2,
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
}
```

Giải thích các thông số:

<table><thead><tr><th width="224">Tên trường</th><th width="134">Bắt buộc</th><th>Mô tả</th></tr></thead><tbody><tr><td>profile_name</td><td>Có</td><td>Tên của profile</td></tr><tr><td>group_name</td><td>Không</td><td>Tên của group</td></tr><tr><td>browser_name</td><td>Không</td><td>Chrome,Firefox (Mặc định Chrome)</td></tr><tr><td>browser_core</td><td>Không</td><td>chromium, firefox (Mặc định chromium)</td></tr><tr><td>browser_version</td><td>Không</td><td></td></tr><tr><td>raw_proxy</td><td>Không</td><td>HTTP proxy| IP:Port:User:Pass<br>Socks5| socks5://IP:Port:User:Pass<br>TMProxy| tm://API_KEY|True,False<br>TinProxy| tin://API_KEY|True,False<br>TinsoftProxy| tinsoft://API_KEY|True,False</td></tr><tr><td>startup_urls</td><td>Không</td><td>Url 1, Url 2, Url 3</td></tr><tr><td>is_noise_canvas</td><td>Không</td><td>Mặc định: false</td></tr><tr><td>is_noise_webgl</td><td>Không</td><td>Mặc định: false</td></tr><tr><td>is_noise_client_rect</td><td>Không</td><td>Mặc định: false</td></tr><tr><td>is_noise_audio_context</td><td>Không</td><td>Mặc định: true</td></tr><tr><td>is_random_screen</td><td>Không</td><td>Mặc định: false</td></tr><tr><td>is_masked_webgl_data</td><td>Không</td><td>Mặc định: true</td></tr><tr><td>is_masked_media_device</td><td>Không</td><td>Mặc định: true</td></tr><tr><td>is_random_browser_version</td><td>Không</td><td>Mặc định: false</td></tr><tr><td>is_random_os</td><td>Không</td><td>Mặc định: false</td></tr><tr><td>os</td><td>Không</td><td>Tên hệ điều hành chỉ định, nhập đúng như trên app</td></tr><tr><td>webrtc_mode</td><td>Không</td><td>1 - Off, 2 - Base on IP (Mặc định: 2)</td></tr><tr><td>is_masked_font</td><td>Không</td><td>Mặc định: true</td></tr><tr><td>user_agent</td><td>Không</td><td></td></tr></tbody></table>

Reponse

```json
{
  "success": true,
  "data": {
    "id": "781d8439-b4c4-4203-a434-c853228110b1",
    "name": "Test profile",
    "raw_proxy": "",
    "profile_path": "wBPmeDpCbL-04122023",
    "browser_type": "Chrome",
    "browser_version": "119.0.6045.124",
    "note": null,
    "group_id": 1,
    "created_at": "2023-12-04T21:33:37.1200267+07:00"
  },
  "message": "OK"
}
```
