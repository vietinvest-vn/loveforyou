# LoveForYou

LoveForYou là ứng dụng web app React/PWA dành cho điện thoại Android và iOS, với giao diện mobile-first và chế độ cài đặt màn hình chính. Ứng dụng dùng API Fastify và MongoDB cho tài khoản, hồ sơ, nhật ký/kỷ niệm/thư riêng tư, lời mời kết nối và thông báo. Trang chủ tổng hợp thông tin thật từ các API hiện có; các màn hình chưa có API không hiển thị dữ liệu demo.

## Chạy cục bộ

Cần Node.js 24+ và npm. MongoDB local cần chạy dưới dạng replica set để các thao tác kết nối nhiều tài liệu được nguyên tử. Có thể dùng MongoDB Atlas hoặc một replica set local.

Mở terminal backend:

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

Mở terminal frontend:

```powershell
cd frontend
npm install
npm run dev
```

Mở `http://localhost:5173`. Vite proxy `/api` đến Fastify ở cổng 3000.

`MONGODB_URI` và `MONGODB_DB_NAME` được đọc từ `backend/.env`. Không commit `.env` hoặc chia sẻ URI chứa thông tin xác thực. Với MongoDB local, khởi động `mongod` bằng `--replSet rs0` và chạy `rs.initiate()` trong `mongosh` một lần trước khi chạy ứng dụng.

Để bật tra cứu số tài khoản, đăng ký VietQR rồi cấu hình `VIETQR_CLIENT_ID` và `VIETQR_API_KEY` chỉ trong `backend/.env`/secret manager. Tạo khóa mã hóa tài khoản riêng 32 byte bằng `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` và đặt vào `BANK_ACCOUNT_ENCRYPTION_KEY`; không thay đổi khóa này nếu chưa có kế hoạch giải mã/chuyển đổi dữ liệu hiện hữu. Backend cache danh sách ngân hàng VietQR trong MongoDB tối đa 24 giờ và chỉ dùng cache cũ tối đa 7 ngày khi upstream lỗi. Không có thông tin xác thực VietQR hợp lệ thì xác minh luôn bị từ chối an toàn. Danh sách ngân hàng được tham chiếu từ [API ngân hàng VietQR](https://www.vietqr.io/api-bank), lookup từ [API tra cứu tài khoản VietQR](https://www.vietqr.io/tra-cuu-stk).

Database SQLite cũ tại `backend/data/loveforyou.sqlite` được giữ nguyên nhưng không còn được sử dụng. Không có bước nhập dữ liệu tự động; hãy sao lưu và lập kế hoạch chuyển đổi riêng trước khi xóa file cũ.

### Khắc phục lỗi xác thực MongoDB Atlas

Nếu backend báo `MongoDB Atlas rejected the database credentials`, hãy kiểm tra username/password của **Database Access user** trong Atlas (khác với tài khoản đăng nhập MongoDB Atlas), cập nhật `MONGODB_URI` trong `backend/.env`, rồi chạy lại backend. Nếu mật khẩu chứa ký tự đặc biệt dành riêng cho URL, hãy percent-encode mật khẩu đó trước khi đưa vào URI. Không dán URI hoặc mật khẩu vào mã nguồn hay gửi chúng trong tin nhắn. `MONGODB_DB_NAME` chọn database ứng dụng và không thay thế thông tin xác thực.

## Kiểm tra

```powershell
cd backend
npm test
```

Backend integration tests khởi chạy MongoDB replica set tạm thời và kiểm tra đăng nhập, quyền sở hữu nội dung, lời mời kết nối, thông báo và bảo vệ Origin.

```powershell
cd frontend
npm test
```

## Triển khai

Cấu hình `NODE_ENV=production`, `CLIENT_ORIGIN` bằng chính xác origin frontend (ví dụ `https://loveforyoutest.vercel.app`), `MONGODB_URI`, `MONGODB_DB_NAME` và `PORT` trên Render. Vercel dùng `frontend/vercel.json` để chuyển tiếp `/api/*` tới backend, giữ request và cookie phiên cùng origin frontend; đặt **Root Directory** của dự án Vercel là `frontend` để nhận cấu hình rewrite. Không cần biến `VITE_API_URL` cho cách triển khai này. Backend vẫn cho phép CORS credentials từ `CLIENT_ORIGIN` và cookie production dùng `Secure; SameSite=None` nếu gọi backend trực tiếp. Không đặt URI MongoDB hoặc khóa API trong frontend.

Nếu frontend không tải được dữ liệu, kiểm tra trong DevTools → Network rằng request phía trình duyệt đi tới `https://loveforyoutest.vercel.app/api/...`; Vercel chuyển tiếp nội bộ tới Render. Kiểm tra `https://loveforyoutest.onrender.com/api/health` trả `{"status":"ok"}` và `CLIENT_ORIGIN` trên Render khớp chính xác origin frontend. `GET /api/auth/me` trả `401` khi chưa đăng nhập là bình thường. Luồng này là frontend gọi backend rồi nhận response; backend không gọi ngược frontend để lấy dữ liệu.

## Phạm vi và giới hạn

Mỗi người phải chủ động gửi/chấp nhận lời mời. Kết nối không cấp quyền đọc nhật ký, thư hoặc ảnh riêng tư. API dùng session cookie `HttpOnly`, mật khẩu scrypt, giới hạn request, kiểm tra Origin và kiểm tra quyền tại server. Ảnh JPEG đã thu nhỏ được lưu trực tiếp trong MongoDB; chưa có object storage.

Admin hiện có menu riêng cho 26 khu vực; các nghiệp vụ người dùng/cặp đôi, cấu hình QR, gói nạp, yêu cầu nạp/rút, đối soát ví và lịch sử biến động xu đã kết nối API. Cấu hình QR chọn ngân hàng từ danh sách VietQR, lưu tên phương thức/ngân hàng/BIN vào MongoDB và hỗ trợ bật/tắt, đặt mặc định; phương thức đã dùng được lưu trữ bằng cách tắt thay vì xóa, còn yêu cầu nạp giữ snapshot thanh toán ban đầu trong `paymentQrImage`. Ảnh nhận tiền của Admin (`paymentQrImage`) và ảnh chứng từ User (`paymentProofImage`) được lưu riêng; chỉ chủ yêu cầu và Admin mới xem được chứng từ, và backend chỉ nhận xác nhận sau khi ảnh chứng từ cùng thời điểm tải lên đã được lưu. Người dùng có thể tìm/chọn ngân hàng, tra cứu tên chủ tài khoản qua backend, xác nhận rồi lưu tài khoản đã xác minh ở dạng mã hóa AES-256-GCM. Giá gói là dữ liệu VND do Admin nhập; backend là nơi tính xu cơ bản theo tỷ lệ cố định 1 xu = 304 VND, làm tròn xuống, còn xu thưởng được cấu hình riêng. Trong trang Ví, người dùng chọn gói có sẵn từ backend, xem QR/thông tin đã chụp, tải/xóa chứng từ, xác nhận gửi và xem lịch sử; mỗi tài khoản chỉ có tối đa một yêu cầu nạp đang mở và có thể tiếp tục yêu cầu đó sau khi tải lại trang. Ảnh giới hạn 600 KB được lưu trực tiếp trong MongoDB. Duyệt nạp yêu cầu Admin xác nhận đã đối chiếu khoản tiền và mã tham chiếu ngân hàng; hệ thống chưa có tích hợp ngân hàng để tự xác minh khoản đã nhận.

Mã giao dịch công khai duy nhất dùng tiền tố `LFN` cho nạp xu, `LFR` cho rút tiền, `LFC` cho hoàn xu và `LFA` cho điều chỉnh số dư. Yêu cầu rút chỉ tạo từ tài khoản ngân hàng đã xác minh, tối thiểu 100 xu và không vượt số dư khả dụng; xu được giữ ngay khi tạo yêu cầu, rồi Admin duyệt/xử lý và ghi mã tham chiếu khi xác nhận đã chuyển tiền. Từ chối, thất bại hoặc hủy hợp lệ sẽ giải phóng phần xu đã giữ. Admin có thể hoàn lại một lần cho mỗi bút toán ghi nợ hoặc điều chỉnh ví với lý do bắt buộc; điều chỉnh không được làm số dư âm. Màn hình quản trị giao dịch hỗ trợ tìm kiếm, loại giao dịch, hướng biến động, khoảng ngày và số xu; người dùng điều chỉnh được tìm/chọn từ danh sách tài khoản thay vì nhập ID thủ công. Yêu cầu cũ giữ mã và snapshot ban đầu; mã giao dịch lịch sử nạp được backfill khi backend khởi động. Quyền Admin hiện chỉ phân biệt `admin` và `member`, chưa hỗ trợ phân quyền chi tiết theo vai trò.

Chưa có xác minh email, khôi phục mật khẩu, xóa tài khoản tự phục vụ, báo cáo vi phạm cặp đôi, chặn/bỏ chặn, ngắt kết nối, album/media storage riêng, thư hẹn giờ, sao lưu/khôi phục hoặc đồng bộ nội dung chung. Premium chưa có mô hình nghiệp vụ/API tương ứng nên không được giả lập. Một số menu Admin còn lại hiện mới có điều hướng/giao diện và chưa được kết nối nghiệp vụ.
