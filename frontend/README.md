# LoveForYou frontend

Frontend React/Vite được thiết kế mobile-first cho điện thoại Android và iOS, và được phát hành như PWA/web app có thể thêm vào màn hình chính. Trang chủ ưu tiên kết nối, ngày kỷ niệm và nội dung thật từ backend. Các màn hình đang hoạt động gồm đăng ký/đăng nhập, hồ sơ, nhật ký, kỷ niệm, thư, lời mời kết nối và thông báo. Ngày sinh và giới tính là thông tin tùy chọn khi đăng ký; đăng nhập có tùy chọn ghi nhớ phiên đăng nhập trên thiết bị. Đăng nhập Google/Apple, quản trị viên và khôi phục mật khẩu chưa được tích hợp và được đánh dấu đang phát triển. Những tính năng chưa có API chưa được đưa vào ứng dụng để tránh hiển thị hoặc lưu dữ liệu mô phỏng.

Love Level lấy ngày bắt đầu từ quan hệ đã được hai người chấp nhận. LV và thời lượng được tính từ ngày này; lịch sử cột mốc và thông báo được lưu trong MongoDB, đồng bộ khi máy chủ chạy và khi một thành viên tải Love Level. Tiến trình tăng theo các cột mốc 7, 30, 100 ngày, 6 tháng, 1/2/3/5/10 năm, sau đó mỗi 5 năm; kỷ niệm theo từng năm vẫn được ghi nhận. Trang cá nhân có danh sách LV với tên, biểu tượng, điều kiện và ngày đạt dự kiến. Thông báo đẩy chưa được tích hợp.

## Chạy cục bộ

```powershell
npm install
npm run dev
```

Khi chạy local, Vite proxy `/api` đến Fastify ở `http://localhost:3000`. Hãy khởi động backend và MongoDB trước.

Khi triển khai bằng Vercel, `vercel.json` chuyển tiếp `/api/*` tới backend Render, nhờ đó frontend gọi API cùng origin và cookie đăng nhập không phụ thuộc cookie bên thứ ba. Nếu dự án Vercel đặt **Root Directory** là `frontend`, cấu hình này được nhận tự động. Không cần khai báo `VITE_API_URL` cho cách triển khai này; nếu đặt biến đó, frontend sẽ gọi backend trực tiếp và cần CORS/cookie cross-site hoạt động. Khi chạy local, frontend dùng đường dẫn `/api` và Vite proxy đến Fastify ở `http://localhost:3000`.

### Khắc phục khi frontend không lấy được dữ liệu

- Kiểm tra request trong DevTools → Network: URL phía trình duyệt phải là `https://loveforyoutest.vercel.app/api/...`; Vercel chuyển tiếp request đó tới Render theo `frontend/vercel.json`. Đảm bảo cấu hình rewrite đã được deploy. Nếu chủ động dùng `VITE_API_URL`, URL sẽ trỏ thẳng đến backend và cần redeploy frontend sau khi sửa biến.
- Mở `https://loveforyoutest.onrender.com/api/health`; phản hồi `{"status":"ok"}` xác nhận backend truy cập được. `GET /api/auth/me` trả `401` khi chưa đăng nhập là bình thường.
- Nếu DevTools báo CORS/preflight khi gọi backend trực tiếp, kiểm tra `CLIENT_ORIGIN` trên Render khớp chính xác origin frontend, gồm `https://` và không có dấu `/` ở cuối; sau khi đổi cấu hình, redeploy backend. Preflight hợp lệ phải có `Access-Control-Allow-Origin` đúng origin và `Access-Control-Allow-Credentials: true`.
- Nếu API hoạt động nhưng phiên đăng nhập không được giữ, kiểm tra frontend và backend đều dùng HTTPS, request có credentials và trình duyệt không chặn cookie bên thứ ba.

Frontend gửi request và cookie phiên tới backend; backend trả dữ liệu trong response. Backend không gọi ngược frontend để lấy dữ liệu. Vì vậy, khi backend không nhận được request, hãy kiểm tra rewrite, DNS/trạng thái Render và lỗi CORS/preflight trong Network; khi frontend nhận `401`, hãy đăng nhập lại để tạo phiên.

Để kiểm tra trên điện thoại cùng mạng Wi-Fi, mở địa chỉ LAN của máy chạy Vite trong Chrome trên Android hoặc Safari trên iOS. Để cài như web app/PWA, triển khai qua HTTPS; dùng **Install app** trên Android hoặc **Share → Add to Home Screen** trên iOS.

## Kiểm tra

```powershell
npm test
```
