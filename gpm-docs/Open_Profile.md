# Mở profile

API URL

```
GET: /api/v3/profiles/start/{id}
```

Params:

| Tên param        | Bắt buộc | Mô tả                                                                                         |
| ---------------- | -------- | --------------------------------------------------------------------------------------------- |
| addination\_args | Không    | Các param khởi động cùng trình duyệt, cần hiểu rõ về trình duyệt mới có thể dùng thông số này |
| win\_scale       | Không    | Giá trị từ 0 tới 1.0                                                                          |
| win\_pos         | Không    | Giá trị tọa độ trình duyệt theo dạng x,y                                                      |
| win\_size        | Không    | Giá trị width,height                                                                          |

Ví dụ

```
http://127.0.0.1:19995/api/v3/profiles/start/xgyasg1995?win_scale=0.8&win_pos=300,300    
```

Repsonse

<pre class="language-json"><code class="lang-json">{
<strong>    "success": true,
</strong>    "data": {
        "success": false,
        "profile_id": "17169ef5-761a-4fc4-9fba-2b634424c8c9",
        "browser_location": "C:\\Users\\buidu\\AppData\\Local\\Programs\\GPMLogin\\gpm_browser\\gpm_browser_chromium_core_119\\chrome.exe",
        "remote_debugging_address": "127.0.0.1:53378",
        "driver_path": "C:\\Users\\buidu\\AppData\\Local\\Programs\\GPMLogin\\gpm_browser\\gpm_browser_chromium_core_119\\gpmdriver.exe"
    },
    "message": "OK"
}
</code></pre>
