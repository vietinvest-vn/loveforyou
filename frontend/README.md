# LoveForYou frontend

Frontend React/Vite được thiết kế mobile-first cho điện thoại Android và iOS, và được phát hành như PWA/web app có thể thêm vào màn hình chính. Trang chủ ưu tiên kết nối, ngày kỷ niệm và nội dung thật từ backend. Các màn hình đang hoạt động gồm đăng ký/đăng nhập, hồ sơ, nhật ký, kỷ niệm, thư, lời mời kết nối và thông báo. Ngày sinh và giới tính là thông tin tùy chọn khi đăng ký; đăng nhập có tùy chọn ghi nhớ phiên đăng nhập trên thiết bị. Đăng nhập Google/Apple, quản trị viên và khôi phục mật khẩu chưa được tích hợp và được đánh dấu đang phát triển. Những tính năng chưa có API chưa được đưa vào ứng dụng để tránh hiển thị hoặc lưu dữ liệu mô phỏng.

Love Level lấy ngày bắt đầu từ quan hệ đã được hai người chấp nhận. LV và thời lượng được tính từ ngày này; lịch sử cột mốc và thông báo được lưu trong MongoDB, đồng bộ khi máy chủ chạy và khi một thành viên tải Love Level. Tiến trình tăng theo các cột mốc 7, 30, 100 ngày, 6 tháng, 1/2/3/5/10 năm, sau đó mỗi 5 năm; kỷ niệm theo từng năm vẫn được ghi nhận. Trang cá nhân có danh sách LV với tên, biểu tượng, điều kiện và ngày đạt dự kiến. Thông báo đẩy chưa được tích hợp.

## Chạy cục bộ

```powershell
npm install
npm run dev
```

Khi chạy local, Vite proxy `/api` đến Fastify ở `http://localhost:3000`. Hãy khởi động backend và MongoDB trước.

Khi triển khai frontend và backend ở hai domain khác nhau, đặt biến môi trường build `VITE_API_URL` trên Vercel bằng **origin** backend (ví dụ `https://loveforyoutest.onrender.com`, không thêm `/api`), rồi build/deploy lại frontend. Frontend tự thêm tiền tố `/api`; nếu không đặt biến này, frontend dùng đường dẫn tương đối `/api` để hoạt động với Vite proxy local. Giá trị này là URL công khai, không chứa bí mật.

Để kiểm tra trên điện thoại cùng mạng Wi-Fi, mở địa chỉ LAN của máy chạy Vite trong Chrome trên Android hoặc Safari trên iOS. Để cài như web app/PWA, triển khai qua HTTPS; dùng **Install app** trên Android hoặc **Share → Add to Home Screen** trên iOS.

## Kiểm tra

```powershell
npm test
```
