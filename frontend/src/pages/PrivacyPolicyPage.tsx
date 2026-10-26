import LegalDocumentPage from '../components/LegalDocumentPage'

export default function PrivacyPolicyPage({ onBack, backLabel }: { onBack: () => void; backLabel?: string }) {
  return <LegalDocumentPage title="Chính sách bảo mật" updatedAt="23/10/2026" onBack={onBack} backLabel={backLabel}>
    <p>Chính sách này mô tả các loại thông tin LoveForYou xử lý để cung cấp tài khoản, hồ sơ, kết nối và các tính năng lưu giữ kỷ niệm.</p>
    <section>
      <h3>1. Thông tin được xử lý</h3>
      <ul>
        <li>Thông tin tài khoản: email, tên hiển thị, mã người dùng và thông tin xác thực.</li>
        <li>Thông tin hồ sơ: ngày sinh, giới tính, bio và các tùy chọn lối tắt.</li>
        <li>Nội dung bạn tạo: nhật ký, thư, kỷ niệm và hình ảnh đính kèm.</li>
        <li>Thông tin kết nối: lời mời, ngày bắt đầu bên nhau, trạng thái kết nối và cột mốc.</li>
        <li>Thông tin vận hành: phiên đăng nhập, thời điểm tạo/cập nhật nội dung và trạng thái thông báo.</li>
      </ul>
    </section>
    <section>
      <h3>2. Cách sử dụng thông tin</h3>
      <p>Thông tin được dùng để xác thực tài khoản, hiển thị hồ sơ, lưu nội dung, xử lý lời mời kết nối, tính cấp độ/cột mốc và gửi thông báo liên quan đến hoạt động trong ứng dụng.</p>
    </section>
    <section>
      <h3>3. Khi thông tin được chia sẻ</h3>
      <p>Khi bạn kết nối với một người dùng, một số thông tin cần thiết như tên hiển thị, mã người dùng và ngày bắt đầu bên nhau được dùng để hiển thị quan hệ và tính năng chung. API yêu cầu đăng nhập và giới hạn dữ liệu theo tài khoản hoặc quan hệ tương ứng.</p>
    </section>
    <section>
      <h3>4. Bảo vệ và lưu trữ</h3>
      <p>Mật khẩu được xử lý dưới dạng mã băm thay vì lưu dưới dạng văn bản đọc được. Phiên đăng nhập được quản lý bằng cookie và thông tin phiên; các biện pháp bảo vệ được áp dụng để hạn chế truy cập trái phép. Không phương thức truyền hoặc lưu trữ nào có thể bảo đảm an toàn tuyệt đối.</p>
    </section>
    <section>
      <h3>5. Quyền kiểm soát của bạn</h3>
      <p>Bạn có thể cập nhật tên hiển thị, bio và một số thông tin hồ sơ trong phần Cài đặt hồ sơ. Bạn có thể đăng xuất để kết thúc phiên trên thiết bị hiện tại.</p>
    </section>
    <section>
      <h3>6. Cập nhật chính sách</h3>
      <p>Chính sách có thể thay đổi khi tính năng hoặc cách xử lý dữ liệu thay đổi. Phiên bản mới nhất và ngày cập nhật sẽ được đăng tại trang này.</p>
    </section>
  </LegalDocumentPage>
}