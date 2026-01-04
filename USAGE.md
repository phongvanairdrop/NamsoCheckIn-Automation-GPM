# Namso Check-in Automation

## Chạy

```bash
npm run test
```

## Menu CLI

```
================================
NAMSO CHECK-IN AUTOMATION
================================

Chon che do chay:
  1. Chay TAT CA profiles
  2. Chay tu profile X den Y
  3. Chay lai cac profile DANG LOI

Lua chon cua ban (1-3):
```

### Mode 1: Chạy TẤT CẢ
- Chạy tất cả profiles trong `config/credentials.xlsx`
- Skip profiles có `Namso = No`

### Mode 2: Chạy từ X đến Y
```
Nhap khoang profiles (VD: Depin010-Depin180):
```
- Format: `Depin010-Depin180` hoặc `Depin010 - Depin180`
- Chạy từ profile start đến end (bao gồm cả 2 cái)

### Mode 3: Chạy lại LỖI
- Chạy lại profiles:
  - Không có trong file `config/results.xlsx`
  - Có lỗi (cột Error có giá trị)

## File config/credentials.xlsx (4 cột)

| ProfileName | ProfileID |     Namso        | Password |
|-------------|-----------|------------------|----------|
| Depin001 | xxx-xxx-xxx  | email@gmail.com  | pass123  |
| Depin002 | xxx-xxx-xxx  | No               | pass456  |

- **Namso**: email = có tài khoản, **No** = skip

## Kết quả

File: `config/results.xlsx`

| ProfileName | Email         | Login | Check-in | Convert | SHARE | Streak | Last Check In    |
|-------------|---------------|-------|----------|---------|-------|--------|------------------|
| Profile001  | xxx@gmail.com |   ✓   |    ✓     |    ✓    | 15000 | 5 Days | 2026-01-04 12:15 |

- **Save NGAY sau mỗi profile** - không mất data khi crash
- Mỗi lần chạy **update** row theo ProfileName

## Lưu ý

1. **GPM phải đang chạy**
2. Tool tự **save data sau mỗi profile xong** - an toàn khi crash
3. Nhập số luồng song hành (1-10) khi được hỏi
