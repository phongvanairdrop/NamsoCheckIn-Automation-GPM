# 🤖 NamsoCheckIN Automation

**Tool tự động check-in Namso với hỗ trợ multi-profile**

---

## 📋 Giới Thiệu

NamsoCheckIN Automation là công cụ tự động hóa việc check-in hàng ngày trên Namso.network với khả năng xử lý nhiều profile song song.

### Tính năng chính

- ✅ **Multi-profile processing** - Chạy cùng lúc nhiều profile
- ✅ **OTP tự động** - Trích xuất mã OTP từ Gmail tự động
- ✅ **Soft fail pattern** - Tiếp tục chạy ngay cả khi có lỗi
- ✅ **Lưu kết quả tức thì** - Save sau mỗi profile, không mất data khi crash
- ✅ **Exponential retry** - Tự động retry khi gặp lỗi tạm thời
- ✅ **Excel tracking** - Lưu kết quả vào file Excel
- ✅ **Telegram notifications** - Thông báo kết quả qua Telegram (tùy chọn)

---

## 🚀 Cài Đặt

### Yêu cầu

- **Node.js 18+** - [Tải tại đây](https://nodejs.org/)
- **GPM-Login** - [Tải tại đây](https://gpmloginapp.com)
- **Windows** - Được tối ưu cho Windows

### Các bước cài đặt

1. **Cài đặt GPM-Login**
   - Download GPM-Login từ Gpmloginapp.com
   - Giải nén và chạy `GPMLogin.exe`
   - GPM sẽ chạy trên port `http://127.0.0.1:19995`

2. **Chạy setup tự động**
   ```bash
   setup.bat
   ```
   Script này sẽ:
   - Kiểm tra Node.js
   - Cài đặt các thư viện npm
   - Tạo cấu trúc thư mục
   - Tạo file `.env` từ template

3. **Cấu hình credentials**
   - Tạo file `config/credentials.xlsx` với định dạng:

   | ProfileName | ProfileID   | Namso            | Password |
   |-------------|-----------  |------------------|----------|
   | Profile001  | xxx-xxx-xxx | email@gmail.com  | pass123  |
   | Profile002  | yyy-yyy-yyy | No               | pass456  |

   **Lưu ý:**
   - `ProfileID`: Lấy từ GPM (chuột phải → Copy Profile ID)
   - `Namso`: Email đăng nhập, hoặc "No" để bỏ qua profile

---

## ⚙️ Cấu Hình

### File `.env`

```env
# GPM API (thường không cần đổi)
GPM_API_URL=http://127.0.0.1:19995

# Số luồng song song (mặc định: 8)
CONCURRENCY=8

# Kích thước cửa sổ browser
WINDOW_SIZE=800x600

# Độ phân giải màn hình (cho grid layout), hay tu setup theo man hinh that
SCREEN_WIDTH=1920
SCREEN_HEIGHT=1080

# Level log (error, warn, info, debug)
LOG_LEVEL=info

# Telegram (tùy chọn - để trống nếu không dùng)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

### Chỉnh sửa cho màn hình của bạn

Nếu màn hình bạn có độ phân giải khác (ví dụ 3440x1440), sửa trong `.env`:

```env
SCREEN_WIDTH=3440
SCREEN_HEIGHT=1440
```

---

## 🎯 Hướng Dẫn Sử Dụng

### Chạy tool

```bash
npm test
```

### Menu lựa chọn

```
================================
NAMSO CHECK-IN AUTOMATION
================================

Chọn chế độ chạy:
  1. Chạy TẤT CẢ profiles
  2. Chạy từ profile X đến Y
  3. Chạy lại các profile ĐANG LỖI

Lựa chọn của bạn (1-3):
```

### Mode 1: Chạy TẤT CẢ

Chạy tất cả profiles trong file `credentials.xlsx`

### Mode 2: Chạy từ X đến Y

Chạy một khoảng profiles (ví dụ: `Profile010-Profile180`)

```
Nhập khoảng profiles (VD: Profile010-Profile180):
```

### Mode 3: Chạy lại LỖI

Chạy lại các profiles:
- Không có trong file `results.xlsx`
- Có lỗi (cột Error có giá trị)

---

## 📊 Kết Quả

Kết quả được lưu vào `config/results.xlsx`:

| ProfileName | Email         | Login | Check-in | Convert | SHARE | Streak | Last Check In    |
|-------------|---------------|-------|----------|---------|-------|--------|------------------|
| Profile001  | xxx@gmail.com |   ✓   |    ✓    |    ✓    | 15000 | 5 Days | 2026-01-04 12:15 |

- **Save NGAY sau mỗi profile** - không mất data khi crash
- Mỗi lần chạy **update** row theo ProfileName

---

## 🔧 Lỗi Thường Gặp

### GPM not running

```
Error: GPM not running
```

**Giải pháp:** Khởi động GPM-Login application

### Profile not found

```
Error: Failed to start profile xxx: No debug address
```

**Giải pháp:** Kiểm tra ProfileID trong credentials.xlsx có khớp với GPM

### OTP timeout

```
Error: OTP timeout (60000ms)
```

**Giải pháp:**
- Kiểm tra Gmail đã đăng nhập chưa
- Tăng `OTP_TIMEOUT_MS` trong `.env`

### Gmail not logged in

```
Gmail not logged in
```

**Giải pháp:** Đăng nhập Gmail trong profile GPM trước khi chạy

---

## 📁 Cấu Trúc Project

```
NamsoCheckIN-Automation/
├── src/
│   ├── core/              # GPM client, credential manager
│   ├── namso/             # Login, OTP, check-in actions
│   ├── infrastructure/    # Logger, Excel writer, Telegram
│   ├── utils/             # Retry logic
│   └── types/             # TypeScript types
├── scripts/
│   └── test-multiple.ts   # Entry point với CLI menu
├── config/
│   ├── credentials.xlsx   # Input: Profile credentials
│   └── results.xlsx       # Output: Kết quả chạy
├── gpm-docs/              # Tài liệu GPM API
├── .env.example           # Template biến môi trường
├── setup.bat              # Script cài đặt tự động
└── README.md              # File này
```

---

## 📚 Tài Liệu Tham Khảo

- `USAGE.md` - Hướng dẫn sử dụng chi tiết
- `GPM_PUPPETEER_GUIDE.md` - Hướng dẫn GPM + Puppeteer
- `gpm-docs/` - Tài liệu API GPM

---

## ⚠️ Lưu Ý Quan Trọng

1. **GPM phải đang chạy** trước khi tool hoạt động
2. Tool tự **save data sau mỗi profile xong** - an toàn khi crash
3. Nhập số luồng song hành (1-10) khi được hỏi
4. File `.env` chứa cấu hình - chỉnh sửa nếu cần
5. `credentials.xlsx` chứa thông tin nhạy cảm - bảo mật kỹ

---

## 🆘 Hỗ Trợ

Nếu gặp lỗi:

1. Kiểm tra `logs/error.log` để xem chi tiết lỗi
2. Chạy mode debug: `npm run debug`
3. Đọc file `GPM_PUPPETEER_GUIDE.md` để hiểu rõ về GPM

---
## Liên Hệ :
Channel : https://t.me/PhongVanAirdrop  
Group Chat : https://t.me/PhongVanAirdropChat  
Tele : @HoaiThuEth95  
GitHub : https://github.com/phongvanairdrop  

**Version:** 1.0.0
**Last Updated:** 2026-01-04



