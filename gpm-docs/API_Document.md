# API document

API giúp bên thứ ba quản lý, thêm, sửa, xóa profiles trên GPM-Login, đồng thời có thể mở hoặc đóng profile một cách an toàn với đầy đủ thông số thiết bị đã tạo.

**Dành cho người mới**

Cách bước kết nối với trình duyệt của GPM-Login thông qua API

Bước 1: Gọi API mở profile.

Bước 2: Sử dụng các thông số mà API trả về (browser\_path, driver\_path, remote\_debugging\_port) để khởi tạo kết nối với selenium hoặc puppeteer.

Bước 3: Sử dụng code bình thường như các loại trình duyệt khác.
