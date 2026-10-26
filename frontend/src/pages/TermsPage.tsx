import LegalDocumentPage from '../components/LegalDocumentPage'
import { Link } from 'react-router-dom'

export default function TermsPage({ onBack, backLabel }: { onBack: () => void; backLabel?: string }) {
  return <LegalDocumentPage title="Điều khoản sử dụng" updatedAt="23/10/2026" onBack={onBack} backLabel={backLabel}>
    <p>Chào mừng bạn đến với LoveForYou. Khi tạo tài khoản hoặc sử dụng ứng dụng, bạn đồng ý tuân thủ các điều khoản dưới đây.</p>
    <section>
      <h3>1. Tài khoản</h3>
      <p>Bạn cần cung cấp thông tin chính xác, giữ bí mật thông tin đăng nhập và chịu trách nhiệm với hoạt động phát sinh từ tài khoản của mình. Hãy báo cho chúng tôi nếu nghi ngờ tài khoản bị truy cập trái phép.</p>
    </section>
    <section>
      <h3>2. Sử dụng dịch vụ</h3>
      <p>Bạn chỉ được sử dụng LoveForYou cho mục đích hợp pháp, không xâm phạm quyền của người khác, không gửi nội dung quấy rối, lừa đảo hoặc cố truy cập dữ liệu không thuộc về mình.</p>
    </section>
    <section>
      <h3>3. Kết nối và nội dung</h3>
      <p>Lời mời kết nối chỉ tạo quan hệ khi người nhận chấp nhận. Bạn chịu trách nhiệm với nhật ký, thư, hình ảnh và nội dung mình đăng; chỉ chia sẻ thông tin của người khác khi có sự đồng ý phù hợp.</p>
    </section>
    <section>
      <h3>4. Quyền riêng tư</h3>
      <p>Việc thu thập và sử dụng thông tin được mô tả trong <Link to="/privacy-policy">Chính sách bảo mật</Link>.</p>
    </section>
    <section>
      <h3>5. Tính khả dụng</h3>
      <p>Một số tính năng có thể đang phát triển, tạm thời không khả dụng hoặc được cập nhật để cải thiện dịch vụ. Chúng tôi sẽ cố gắng thông báo khi có thay đổi quan trọng.</p>
    </section>
    <section>
      <h3>6. Thay đổi điều khoản</h3>
      <p>Điều khoản có thể được cập nhật khi dịch vụ thay đổi. Phiên bản mới sẽ được đăng tại trang này cùng ngày cập nhật.</p>
    </section>
  </LegalDocumentPage>
}