import React, { useState, useMemo } from 'react';
import { ActiveSection } from '../layout/Sidebar';
import {
  BookOpen,
  FolderKanban,
  SlidersHorizontal,
  Map,
  Calculator,
  Paperclip,
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  Lightbulb,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
  Anchor,
  Wind,
  Layers,
  HelpCircle,
  Scale,
  Sparkles,
  FileText,
  Boxes,
  Compass
} from 'lucide-react';

interface GuideViewProps {
  onSelectSection: (section: ActiveSection) => void;
}

type GuideTab = 'overview' | 'steps' | 'diagram' | 'formulas' | 'troubleshooting' | 'faq';

export const GuideView: React.FC<GuideViewProps> = ({ onSelectSection }) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [selectedStep, setSelectedStep] = useState<number>(1);
  const [activeForceInfo, setActiveForceInfo] = useState<string | null>('wind');

  // FAQ list
  const faqList = [
    {
      q: 'Khi bảng kết quả báo "KHÔNG ĐẠT" (Màu đỏ), tôi cần điều chỉnh thông số nào trước?',
      a: 'Hãy nhìn vào dòng "Hạng mục vi phạm" trên thanh kết luận:\n• Nếu vi phạm sức bền kéo cáp (C2 hoặc C6): Vào mục "2. Thông Số Đầu Vào" -> Tab Dây Cáp -> Chọn mã cáp lớn hơn (ví dụ nâng từ PES-24 lên PES-28, PES-32 hoặc PES-36) hoặc tăng thêm số lượng dây neo.\n• Nếu vi phạm sức chịu cọc bờ (C1 hoặc C7): Vào tab Cọc & Mỏ Neo -> Tăng kích thước cạnh cọc D (từ 0.40m lên 0.45m/0.50m) hoặc tăng chiều sâu ngàm cọc L trong đất.\n• Nếu vi phạm cọc lòng hồ bị nhổ (C5): Tăng chiều sâu cọc đáy L hoặc kéo dài khoảng cách từ mép bè tới cọc để giảm góc dốc của cáp (θ nhỏ hơn).'
    },
    {
      q: 'Dữ liệu tôi nhập có bị mất khi đóng trình duyệt hay tải lại trang web không?',
      a: 'Không bị mất. Toàn bộ thông số dự án, dữ liệu hình học bè, môi trường, cáp và cọc được tự động lưu tức thì (Auto-save) vào LocalStorage của trình duyệt máy bạn. Khi bạn mở lại trang web, mọi thông số sẽ giữ nguyên trạng thái làm việc gần nhất.'
    },
    {
      q: 'Làm thế nào để khôi phục lại dữ liệu chuẩn ban đầu của Dự án Hồ Huổi Vanh?',
      a: 'Vào mục "1. Dự Án & Cụm Bè" ở menu trái, sau đó nhấn nút "Dữ liệu gốc Huổi Vanh" (có biểu tượng làm mới). Phần mềm sẽ nạp lại toàn bộ thông số chuẩn của 12 cụm bè (BÈ 1 đến BÈ 13, đã gộp BÈ 7+8 theo bản vẽ MB-B01) theo đúng hồ sơ thiết kế mới nhất.'
    },
    {
      q: 'Làm sao để xuất hoặc in báo cáo thuyết minh tính toán sang file PDF đẹp mắt?',
      a: 'Bạn có thể nhấn nút "In Báo Cáo" trên thanh Header hoặc chọn mục "6. Báo Cáo Kỹ Thuật" ở menu trái. Trên màn hình thuyết minh, nhấn nút "In Thuyết Minh / Xuất PDF" (hoặc bấm tổ hợp phím Ctrl + P). Trong hộp thoại in của trình duyệt, chọn "Lưu dưới dạng PDF" (Save as PDF) với khổ giấy A4 dọc.'
    },
    {
      q: 'Hệ số tập trung tải trọng k_focus có ý nghĩa gì và nên chọn trong khoảng nào?',
      a: 'k_focus là hệ số phân bố lực bất lợi nhất tác dụng lên cụm dây neo chịu lực chính khi hướng gió thổi chéo góc so với cụm bè. Theo tiêu chuẩn thiết kế hệ neo FPV (DNV-ST-0119 & khuyến nghị chuyên gia), giá trị này thường dao động từ 0.10 đến 0.36 tùy theo hình dạng và độ cứng của sơ đồ liên kết từng cụm bè (dự án Huổi Vanh dùng từ 0.10 đến 0.36; riêng BÈ 1 lấy k_focus = 0.276).'
    },
    {
      q: 'Tôi có thể tải file Excel thông số từ máy tính lên để phần mềm tự tính không?',
      a: 'Có. Bạn nhấn nút "Nhập Excel" trên thanh Header. Tại hộp thoại xuất hiện, bạn có thể tải "File mẫu chuẩn (.xlsx)", điền số liệu của công trình rồi tải lên. Bảng xem trước cho phép bạn kiểm tra và sửa nhanh từng ô số trước khi bấm "Áp dụng vào biểu mẫu tính toán".'
    }
  ];

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const filteredFaq = useMemo(() => {
    if (!searchQuery.trim()) return faqList;
    const q = searchQuery.toLowerCase();
    return faqList.filter(
      item => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
    );
  }, [searchQuery, faqList]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Modern Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 border border-slate-800 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-10 w-60 h-60 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-semibold">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Cẩm Nang Hướng Dẫn Kỹ Thuật &amp; Cơ Học Hệ Neo Bè Pin Nổi</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white">
              Sổ Tay Hướng Dẫn Tính Toán &amp; Đánh Giá An Toàn
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Tài liệu hướng dẫn toàn diện: Quy trình 6 bước làm việc, sơ đồ phân tích lực cơ học, tra cứu công thức chuẩn hóa (DNV-ST-0119, Broms, Catenary) và cẩm nang xử lý sự cố.
            </p>
          </div>

          {/* Quick Action Navigation */}
          <div className="flex flex-wrap sm:flex-nowrap lg:flex-col gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onSelectSection('input')}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-gradient-to-r from-brand-500 to-sky-500 hover:from-brand-400 hover:to-sky-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-900/50 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Vào Nhập Thông Số Tính</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onSelectSection('results')}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span>Xem Kết Quả &amp; Kiểm Tra</span>
            </button>
          </div>
        </div>

        {/* Sub-tabs Navigation */}
        <div className="mt-8 pt-4 border-t border-slate-800/80 flex flex-wrap gap-2">
          {[
            { id: 'overview' as GuideTab, label: '1. Bắt Đầu Nhanh', icon: Sparkles },
            { id: 'steps' as GuideTab, label: '2. Quy Trình 6 Bước', icon: Layers },
            { id: 'diagram' as GuideTab, label: '3. Sơ Đồ Cơ Học Hệ Neo', icon: Compass },
            { id: 'formulas' as GuideTab, label: '4. Công Thức & Tiêu Chuẩn', icon: Scale },
            { id: 'troubleshooting' as GuideTab, label: '5. Cẩm Nang Xử Lý Lỗi', icon: Lightbulb },
            { id: 'faq' as GuideTab, label: '6. Câu Hỏi Thường Gặp', icon: HelpCircle },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW / QUICK START                                             */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Quick Flow Grid */}
          <div className="card card-pad">
            <div className="card-header">
              <div>
                <h3 className="card-title flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-600" />
                  Quy Trình Tính Toán Chuẩn 6 Bước
                </h3>
                <p className="card-subtitle">
                  Nhấp vào từng bước bên dưới để điều hướng trực tiếp tới giao diện làm việc
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Step 1 */}
              <div
                onClick={() => onSelectSection('project')}
                className="group p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-brand-50/60 hover:border-brand-300 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-lg bg-brand-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-sm">
                      1
                    </span>
                    <FolderKanban className="w-5 h-5 text-slate-400 group-hover:text-brand-600 transition-colors" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 group-hover:text-brand-900">
                    1. Quản Lý Dự Án &amp; Chọn Cụm Bè
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Chọn nhanh từ <strong>BÈ 1 đến BÈ 13</strong> của Hồ Huổi Vanh hoặc tạo dự án mới, tự động nạp diện tích, số tấm pin và sơ đồ cáp.
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-brand-600 group-hover:translate-x-1 transition-transform">
                  <span>Mở Tab Dự Án</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>

              {/* Step 2 */}
              <div
                onClick={() => onSelectSection('input')}
                className="group p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-brand-50/60 hover:border-brand-300 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-lg bg-brand-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-sm">
                      2
                    </span>
                    <SlidersHorizontal className="w-5 h-5 text-slate-400 group-hover:text-brand-600 transition-colors" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 group-hover:text-brand-900">
                    2. Thiết Lập Thông Số Đầu Vào
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Khai báo kích thước bè, vận tốc gió bão V_wind, chọn mã cáp Polyester (PES-24 đến PES-48), cọc neo Broms L và c_u.
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-brand-600 group-hover:translate-x-1 transition-transform">
                  <span>Mở Tab Đầu Vào</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>

              {/* Step 3 */}
              <div
                onClick={() => onSelectSection('map')}
                className="group p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-brand-50/60 hover:border-brand-300 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-lg bg-brand-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-sm">
                      3
                    </span>
                    <Map className="w-5 h-5 text-slate-400 group-hover:text-brand-600 transition-colors" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 group-hover:text-brand-900">
                    3. Mặt Bằng &amp; Tọa Độ Neo
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Bản đồ số hóa 299 điểm cọc bờ &amp; cọc đáy hồ, tra cứu tọa độ thực tế X, Y, Z, chiều dài nhịp cáp và góc nghiêng tuyến kéo.
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-brand-600 group-hover:translate-x-1 transition-transform">
                  <span>Mở Bản Đồ Mặt Bằng</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>

              {/* Step 4 */}
              <div
                onClick={() => onSelectSection('results')}
                className="group p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-brand-50/60 hover:border-brand-300 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-lg bg-brand-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-sm">
                      4
                    </span>
                    <Calculator className="w-5 h-5 text-slate-400 group-hover:text-brand-600 transition-colors" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 group-hover:text-brand-900">
                    4. Kết Quả &amp; Kiểm Tra An Toàn
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Kiểm tra 7 tiêu chí an toàn bắt buộc C1 - C7: Bền cáp nguyên vẹn &amp; sự cố đứt 1 dây, sức chịu ngang cọc Broms, chống nhổ cọc bùn đáy &amp; mômen uốn.
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-brand-600 group-hover:translate-x-1 transition-transform">
                  <span>Mở Bảng Kiểm Tra</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>

              {/* Step 5 */}
              <div
                onClick={() => onSelectSection('files')}
                className="group p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-brand-50/60 hover:border-brand-300 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-lg bg-brand-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-sm">
                      5
                    </span>
                    <Paperclip className="w-5 h-5 text-slate-400 group-hover:text-brand-600 transition-colors" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 group-hover:text-brand-900">
                    5. Bản Vẽ CAD DXF &amp; Tài Liệu
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Trình vẽ Canvas tích hợp file CAD DXF cho phép zoom/pan trực tiếp, xem hồ sơ thiết kế PDF và đính kèm tài liệu dung lượng tới 25MB.
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-brand-600 group-hover:translate-x-1 transition-transform">
                  <span>Mở Tài Liệu Đính Kèm</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>

              {/* Step 6 */}
              <div
                onClick={() => onSelectSection('report')}
                className="group p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-brand-50/60 hover:border-brand-300 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-lg bg-brand-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-sm">
                      6
                    </span>
                    <Printer className="w-5 h-5 text-slate-400 group-hover:text-brand-600 transition-colors" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 group-hover:text-brand-900">
                    6. Xuất Excel &amp; In Báo Cáo A4
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Xuất workbook Excel 6 sheet đầy đủ công thức giải, hoặc in trực tiếp thuyết minh A4 chuyên nghiệp có sẵn 3 khung chữ ký kiểm duyệt.
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-brand-600 group-hover:translate-x-1 transition-transform">
                  <span>Mở Báo Cáo Kỹ Thuật</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>
            </div>
          </div>

          {/* Key Advantages Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card card-pad bg-gradient-to-b from-white to-slate-50">
              <div className="flex items-center gap-3 text-brand-700 mb-3">
                <div className="p-2.5 bg-brand-100 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Chuẩn Hóa Quốc Tế &amp; Việt Nam</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tích hợp đồng thời tiêu chuẩn quốc tế hàng hải <strong>DNV-ST-0119</strong> (Hệ neo bè nổi), <strong>API RP 2SK</strong> cùng hệ thống tiêu chuẩn thủy công <strong>TCVN 11823, QCVN</strong>.
              </p>
            </div>

            <div className="card card-pad bg-gradient-to-b from-white to-slate-50">
              <div className="flex items-center gap-3 text-emerald-700 mb-3">
                <div className="p-2.5 bg-emerald-100 rounded-xl">
                  <Calculator className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Thuật Toán Broms &amp; Catenary</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Giải chính xác sức chịu tải cọc ngắn/trung bình ngàm trong đất dính theo lý thuyết Broms kinh điển, kết hợp mô phỏng độ chùng dây xích Catenary để đánh giá nguy cơ nhổ cọc đáy hồ.
              </p>
            </div>

            <div className="card card-pad bg-gradient-to-b from-white to-slate-50">
              <div className="flex items-center gap-3 text-sky-700 mb-3">
                <div className="p-2.5 bg-sky-100 rounded-xl">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Tương Thích Excel &amp; CAD DXF</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Đọc/ghi trực tiếp định dạng Microsoft Excel 6 sheet hoàn toàn không cần server backend; nhúng bộ giải mã đồ họa CAD DXF để tương tác trực quan với bản vẽ mặt bằng cọc neo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DETAILED STEP-BY-STEP GUIDE                                        */}
      {/* ========================================================================= */}
      {activeTab === 'steps' && (
        <div className="space-y-6 animate-fade-in">
          {/* Step Selector Horizontal Bar */}
          <div className="card p-2 bg-white flex flex-wrap gap-1.5 border border-slate-200 shadow-sm">
            {[
              { num: 1, name: '1. Dự Án & Cụm Bè', icon: FolderKanban, target: 'project' as ActiveSection },
              { num: 2, name: '2. Thông Số Đầu Vào', icon: SlidersHorizontal, target: 'input' as ActiveSection },
              { num: 3, name: '3. Mặt Bằng & Tọa Độ', icon: Map, target: 'map' as ActiveSection },
              { num: 4, name: '4. Kết Quả & Đánh Giá', icon: Calculator, target: 'results' as ActiveSection },
              { num: 5, name: '5. Bản Vẽ & Tài Liệu', icon: Paperclip, target: 'files' as ActiveSection },
              { num: 6, name: '6. Báo Cáo & In Ấn', icon: Printer, target: 'report' as ActiveSection },
            ].map(s => {
              const Icon = s.icon;
              const isCur = selectedStep === s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setSelectedStep(s.num)}
                  className={`flex-1 min-w-[130px] px-3 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    isCur
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{s.name}</span>
                </button>
              );
            })}
          </div>

          {/* Detailed Content Per Step */}
          {selectedStep === 1 && (
            <div className="card card-pad space-y-5 animate-fade-in">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="px-2.5 py-1 rounded bg-brand-100 text-brand-800 text-[11px] font-bold uppercase">
                    Bước 1 / 6
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    Quản Lý Dự Án &amp; Chọn Cụm Bè Tính Toán
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Khởi tạo hồ sơ công trình và chọn cụm bè trong tổng thể 12 cụm bè Hồ Huổi Vanh
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectSection('project')}
                  className="btn btn-sm btn-primary shrink-0"
                >
                  <span>Chuyển tới Tab Dự Án</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-brand-600" />
                    Các thao tác chính trong màn hình này:
                  </h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      <strong>Chọn cụm bè (BÈ 1 đến BÈ 13, không có BÈ 8 — đã gộp vào BÈ 7):</strong> Thanh nút bấm trên đầu trang cho phép chuyển đổi tức thì giữa 12 cụm bè. Khi chọn bè nào, toàn bộ kích thước hình học (L x W), số tấm pin, mã cáp và số dây neo của cụm bè đó sẽ được nạp tự động.
                    </li>
                    <li>
                      <strong>Nút "Dữ liệu gốc Huổi Vanh":</strong> Nhấn nút này khi muốn hủy bỏ các chỉnh sửa thử nghiệm để khôi phục cấu hình chuẩn ban đầu theo hồ sơ thiết kế.
                    </li>
                    <li>
                      <strong>Nút "Tạo dự án mới":</strong> Mở một không gian tính toán độc lập để kỹ sư nhập thông số cho dự án FPV hồ chứa khác.
                    </li>
                    <li>
                      <strong>Bảng Thông tin dự án:</strong> Điền Tên công trình, Mã hiệu, Địa điểm xây dựng, Tên kỹ sư thiết kế và Ngày lập báo cáo.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {selectedStep === 2 && (
            <div className="card card-pad space-y-5 animate-fade-in">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="px-2.5 py-1 rounded bg-brand-100 text-brand-800 text-[11px] font-bold uppercase">
                    Bước 2 / 6
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    Thiết Lập Thông Số Kỹ Thuật Đầu Vào (Input Forms)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Khai báo kích thước hình học, tải trọng môi trường, cáp kéo, cọc neo Broms và tiêu chuẩn an toàn
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectSection('input')}
                  className="btn btn-sm btn-primary shrink-0"
                >
                  <span>Chuyển tới Tab Đầu Vào</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700 leading-relaxed">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-brand-600" />
                    1. Hình học Bè &amp; Tấm pin FPV (RaftForm)
                  </h4>
                  <p>
                    • Chiều dài (L) và Chiều rộng (W) cụm bè (m).<br />
                    • Mớn nước (d) và Chiều cao mạn nổi (Freeboard).<br />
                    • Số lượng tấm pin, Diện tích 1 tấm (A = 2.701 m&sup2;), Góc nghiêng pin (&theta; = 12&deg;), Hệ số che chắn (&eta; = 0.55).<br />
                    • Khoảng cách 4 cạnh bè tới bờ/cọc đáy lân cận để tự tính chiều dài và góc kéo cáp.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Wind className="w-4 h-4 text-sky-600" />
                    2. Môi trường &amp; Khí tượng (EnvForm)
                  </h4>
                  <p>
                    • Độ sâu nước lớn nhất tại vị trí cụm bè (h, m).<br />
                    • Vận tốc gió thiết kế (V_wind, m/s). Ví dụ 30 m/s ứng với bão cấp 11.<br />
                    • Vận tốc dòng chảy (V_current) và Chiều cao sóng (H_s).<br />
                    • Hệ số tổ hợp tải trọng môi trường đồng thời (1.05).
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    3. Cáp Neo Polyester &amp; Xích (LineForm)
                  </h4>
                  <p>
                    • Tra cứu catalogue cáp PES: <code>PES-24</code> (172 kN) đến <code>PES-48</code> (688 kN).<br />
                    • Lực căng trước ban đầu T_0 (5 kN).<br />
                    • Hệ số tập trung lực k_focus (dự án Huổi Vanh: 0.10 ~ 0.36, BÈ 1 = 0.276).<br />
                    • Số lượng dây neo bờ và số lượng dây neo vào cọc lòng hồ.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Anchor className="w-4 h-4 text-emerald-600" />
                    4. Cọc Neo Đất Broms (AnchorForm)
                  </h4>
                  <p>
                    • Cọc bê tông cốt thép vuông đóng ngàm bờ và đáy lòng hồ.<br />
                    • Sức kháng cắt không thoát nước: c_u bờ (40 kPa) &amp; c_u đáy (20 kPa).<br />
                    • Kích thước cạnh cọc vuông D (0.45m) và Chiều sâu ngàm L (6.5m bờ / 8.0m đáy).<br />
                    • Hệ số an toàn cọc neo quy định FS = 2.5.
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedStep === 3 && (
            <div className="card card-pad space-y-5 animate-fade-in">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="px-2.5 py-1 rounded bg-brand-100 text-brand-800 text-[11px] font-bold uppercase">
                    Bước 3 / 6
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    Xem &amp; Khai Thác Bản Đồ Mặt Bằng Tọa Độ 299 Điểm Neo
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Trực quan hóa vị trí thực địa của 12 cụm bè và hệ thống cọc neo hồ Huổi Vanh
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectSection('map')}
                  className="btn btn-sm btn-primary shrink-0"
                >
                  <span>Chuyển tới Bản Đồ</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                    <div className="font-bold text-emerald-900 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                      Cọc Neo Bờ (Màu Xanh Lá)
                    </div>
                    <p className="text-emerald-800">
                      Cọc bê tông cốt thép vuông đóng ngàm vào taluy bờ hồ tại các cao trình khống chế. Đóng vai trò neo giữ chính cho các cạnh Bắc, Nam, Đông của các cụm bè sát bờ.
                    </p>
                  </div>

                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                    <div className="font-bold text-amber-900 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                      Cọc Neo Đáy Lòng Hồ (Màu Cam)
                    </div>
                    <p className="text-amber-800">
                      Cọc đóng ngàm vào tầng bùn/sét đáy lòng hồ nằm ở khoảng giữa hai cụm bè lân cận. Được dùng chung để neo giữ đồng thời cả 2 cạnh Tây và Đông của 2 cụm bè kế tiếp.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedStep === 4 && (
            <div className="card card-pad space-y-5 animate-fade-in">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="px-2.5 py-1 rounded bg-brand-100 text-brand-800 text-[11px] font-bold uppercase">
                    Bước 4 / 6
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    Đánh Giá Kết Quả Tính Toán &amp; 7 Tiêu Chí An Toàn
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Huy hiệu kết luận tổng thể ĐẠT/KHÔNG ĐẠT và bảng kiểm tra điều kiện kỹ thuật C1 - C7
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectSection('results')}
                  className="btn btn-sm btn-primary shrink-0"
                >
                  <span>Chuyển tới Kết Quả</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 text-brand-800">
                    A. Hệ Thống Neo Cọc Broms (Phương án chính Hồ Huổi Vanh)
                  </h4>
                  <div className="table-wrap mb-4">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th className="w-16">Mã</th>
                          <th>Hạng mục kiểm tra</th>
                          <th>Điều kiện kỹ thuật</th>
                          <th>Ý nghĩa &amp; Ngưỡng an toàn</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="font-mono font-bold text-brand-700">C2</td>
                          <td className="font-medium text-slate-800">Bền cáp PES (Nguyên vẹn)</td>
                          <td className="font-mono">SF = MBL / T_max &ge; 3.0</td>
                          <td>Dây cáp chịu lực lớn nhất không bị đứt dưới tác động gió bão thiết kế.</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-brand-700">C6</td>
                          <td className="font-medium text-slate-800">Bền cáp PES (Đứt 1 dây sự cố)</td>
                          <td className="font-mono">SF = MBL / T_max,dam &ge; 2.0</td>
                          <td>Hệ thống vẫn an toàn khi xảy ra sự cố đứt 1 dây neo bất lợi nhất.</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-emerald-700">BP-1</td>
                          <td className="font-medium text-slate-800">Sức chịu tải ngang cọc BỜ (Broms)</td>
                          <td className="font-mono">H_applied / H_allow &le; 1.0</td>
                          <td>Áp lực đất bờ p_u = 9.c_u.D giữ cọc không bị nghiêng đổ (FS = 2.5).</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-emerald-700">BP-2</td>
                          <td className="font-medium text-slate-800">Ứng suất uốn cọc BỜ</td>
                          <td className="font-mono">M_max / M_rd &le; 1.0</td>
                          <td>Mômen uốn do lực kéo cáp không làm nứt gãy thân cọc BTCT.</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-amber-700">BP-3</td>
                          <td className="font-medium text-slate-800">Sức chịu tải ngang cọc LÒNG HỒ</td>
                          <td className="font-mono">Th / H_allow &le; 1.0</td>
                          <td>Cọc cắm bùn đáy giữ được lực kéo ngang tổng hợp từ 2 cụm bè lân cận.</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-amber-700">BP-4</td>
                          <td className="font-medium text-slate-800">Khả năng chống NHỔ cọc LÒNG HỒ</td>
                          <td className="font-mono">Tv / Q_uplift,all &le; 1.0</td>
                          <td>Ma sát thành bên bùn sét Q = &alpha;.c_u.(4D).L chống lại lực kéo đứng Tv (FS = 2.0).</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-amber-700">BP-5</td>
                          <td className="font-medium text-slate-800">Ứng suất uốn cọc LÒNG HỒ</td>
                          <td className="font-mono">M_max / M_rd &le; 1.0</td>
                          <td>Thân cọc lòng hồ đủ khả năng chịu uốn theo tiết diện bê tông cốt thép.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 text-slate-600">
                    B. Hệ Thống Mỏ Neo Kéo &amp; Neo Trọng Lực (Drag Anchor / Deadweight)
                  </h4>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th className="w-16">Mã</th>
                          <th>Hạng mục kiểm tra</th>
                          <th>Điều kiện kỹ thuật</th>
                          <th>Ý nghĩa &amp; Ngưỡng an toàn</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="font-mono font-bold text-slate-700">C1</td>
                          <td className="font-medium text-slate-800">Sức giữ mỏ neo (Nguyên vẹn)</td>
                          <td className="font-mono">SF = R_total / H_line &ge; [SF]</td>
                          <td>Mỏ neo không bị cày trượt trên bề mặt nền đáy hồ (FS &ge; 1.5 ~ 2.0).</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-slate-700">C3</td>
                          <td className="font-medium text-slate-800">Chiều dài xích nằm đáy chống nhổ</td>
                          <td className="font-mono">L_ground &ge; L_ground,min</td>
                          <td>Có đủ đoạn xích tì sát nền đáy để lực kéo vào mỏ neo hoàn toàn theo phương ngang.</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-slate-700">C4</td>
                          <td className="font-medium text-slate-800">Tỷ lệ chiều dài dây / độ sâu nước</td>
                          <td className="font-mono">Scope = L_total / d &ge; 3.0 ~ 5.0</td>
                          <td>Đảm bảo độ chùng cần thiết của đường cong dây xích Catenary.</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-slate-700">C5</td>
                          <td className="font-medium text-slate-800">Sức giữ mỏ neo (Đứt 1 dây)</td>
                          <td className="font-mono">SF = R_total / H_line,dam &ge; [SF]</td>
                          <td>Mỏ neo vẫn giữ ổn định khi 1 dây neo trong cụm bị đứt.</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-slate-700">C7</td>
                          <td className="font-medium text-slate-800">Độ thiếu chiều dài dây neo (Cảnh báo)</td>
                          <td className="font-mono">X_deficit &le; maxOffset</td>
                          <td>Cảnh báo khi dây bị căng thẳng thiếu đoạn võng dự trữ tiếp đất.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedStep === 5 && (
            <div className="card card-pad space-y-5 animate-fade-in">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="px-2.5 py-1 rounded bg-brand-100 text-brand-800 text-[11px] font-bold uppercase">
                    Bước 5 / 6
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    Quản Lý Bản Vẽ CAD (.DXF), PDF &amp; Hồ Sơ Thiết Kế
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Xem trực tiếp tài liệu kỹ thuật nhúng và đính kèm hồ sơ dự án
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectSection('files')}
                  className="btn btn-sm btn-primary shrink-0"
                >
                  <span>Chuyển tới Tài Liệu</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-700 leading-relaxed">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-600" />
                    Trình Xem Bản Vẽ CAD (.DXF)
                  </div>
                  <p className="text-slate-600">
                    Vẽ trực tiếp file DXF lên Canvas. Hỗ trợ đầy đủ phóng to, thu nhỏ, di chuyển bản vẽ mặt bằng bố trí hệ neo 12 bè.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    Xem Hồ Sơ PDF &amp; Ảnh
                  </div>
                  <p className="text-slate-600">
                    Xem trực tiếp tài liệu hồ sơ tính toán, bản đồ trắc địa, hình ảnh phối cảnh bè nổi chất lượng cao.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-emerald-600" />
                    Tải Lên Tài Liệu Mới
                  </div>
                  <p className="text-slate-600">
                    Kéo thả file PDF, CAD DXF/DWG, Excel, PNG/JPG từ máy tính vào để lưu trữ kèm theo phiên làm việc (tối đa 25MB).
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedStep === 6 && (
            <div className="card card-pad space-y-5 animate-fade-in">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="px-2.5 py-1 rounded bg-brand-100 text-brand-800 text-[11px] font-bold uppercase">
                    Bước 6 / 6
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    Xuất / Nhập Excel &amp; In Báo Cáo Thuyết Minh A4
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Đồng bộ bảng tính với Microsoft Excel và xuất hồ sơ in ấn chuẩn kỹ thuật
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectSection('report')}
                  className="btn btn-sm btn-primary shrink-0"
                >
                  <span>Chuyển tới Báo Cáo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-700 leading-relaxed">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Xuất Workbook Excel 6 Sheet
                  </h4>
                  <p className="text-slate-600">
                    Bấm nút <strong>"Xuất Excel"</strong> trên Header để tạo file <code>.xlsx</code> với 6 sheet chi tiết:
                    ThongTinDuAn, DuLieuDauVao, KetQuaTrungGian, BangKiemTra, TongHop13Be, GhiChu.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Printer className="w-4 h-4 text-brand-600" />
                    In Thuyết Minh Chuẩn A4 Khổ Dọc
                  </h4>
                  <p className="text-slate-600">
                    Báo cáo kỹ thuật được định dạng chuẩn A4 có đầy đủ thông tin cơ quan, bảng thông số, bảng kiểm tra và <strong>3 khung chữ ký</strong> trách nhiệm (Người lập, Người kiểm tra, Chủ nhiệm dự án).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MECHANICAL SYSTEM & EQUILIBRIUM DIAGRAM                            */}
      {/* ========================================================================= */}
      {activeTab === 'diagram' && (
        <div className="space-y-6 animate-fade-in">
          <div className="card card-pad">
            <div className="card-header">
              <div>
                <h3 className="card-title flex items-center gap-2">
                  <Compass className="w-5 h-5 text-brand-600" />
                  Sơ Đồ Phân Tích Lực Cơ Học &amp; Cân Bằng Hệ Neo Bè Pin Nổi
                </h3>
                <p className="card-subtitle">
                  Rà chuột hoặc nhấn vào các mũi tên lực trên sơ đồ để xem công thức và nguyên lý truyền lực
                </p>
              </div>
            </div>

            {/* Interactive SVG Diagram */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-white overflow-hidden shadow-inner">
              <div className="w-full flex justify-center">
                <svg viewBox="0 0 900 420" className="w-full max-w-4xl h-auto select-none font-sans">
                  {/* Sky Background */}
                  <rect x="0" y="0" width="900" height="200" fill="#0f172a" opacity="0.8" />
                  
                  {/* Water Body */}
                  <rect x="0" y="200" width="900" height="220" fill="#0284c7" fillOpacity="0.15" />
                  <path d="M 0,200 Q 150,195 300,200 T 600,200 T 900,200 L 900,205 L 0,205 Z" fill="#38bdf8" opacity="0.4" />
                  <text x="30" y="225" fill="#38bdf8" fontSize="11" fontWeight="bold">MẶT NƯỚC HỒ CHỨA (WL)</text>

                  {/* Lake Shore */}
                  <path d="M 0,130 L 180,200 L 180,420 L 0,420 Z" fill="#334155" />
                  <text x="30" y="160" fill="#94a3b8" fontSize="11" fontWeight="bold">TALUY BỜ ĐẤT (c_u = 40 kPa)</text>

                  {/* Shore Pile */}
                  <rect x="90" y="120" width="24" height="150" rx="3" fill="#10b981" stroke="#059669" strokeWidth="2" />
                  <text x="75" y="105" fill="#34d399" fontSize="11" fontWeight="bold">CỌC BỜ (D=0.45m, L=6.5m)</text>

                  {/* Floating Raft Body */}
                  <g transform="translate(360, 160)">
                    {/* Raft Floats */}
                    <rect x="0" y="30" width="240" height="20" rx="4" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="65" y="44" fill="#e0f2fe" fontSize="10" fontWeight="bold">PHAO NỔI HDPE (d = 0.15m)</text>

                    {/* Solar PV Panels */}
                    <g transform="translate(10, 5)">
                      <line x1="0" y1="25" x2="35" y2="10" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
                      <line x1="45" y1="25" x2="80" y2="10" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
                      <line x1="90" y1="25" x2="125" y2="10" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
                      <line x1="135" y1="25" x2="170" y2="10" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
                      <line x1="180" y1="25" x2="215" y2="10" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
                    </g>
                    <text x="50" y="-2" fill="#fbbf24" fontSize="11" fontWeight="bold">DÀN PIN MẶT TRỜI (Góc nghiêng 12°)</text>
                  </g>

                  {/* Mooring Cable to Shore */}
                  <path d="M 114,140 Q 230,175 360,190" fill="none" stroke="#38bdf8" strokeWidth="3.5" strokeDasharray="6 3" />
                  <text x="210" y="160" fill="#7dd3fc" fontSize="11" fontWeight="bold">Cáp PES (T_max &asymp; 61 kN)</text>

                  {/* Mooring Cable to Lakebed */}
                  <path d="M 600,190 Q 720,260 780,330" fill="none" stroke="#f97316" strokeWidth="3" strokeDasharray="5 3" />
                  <text x="670" y="240" fill="#fdba74" fontSize="11" fontWeight="bold">Cáp neo đáy (Góc θ)</text>

                  {/* Lakebed Soil */}
                  <rect x="180" y="340" width="720" height="80" fill="#1e293b" />
                  <text x="400" y="385" fill="#64748b" fontSize="11" fontWeight="bold">TẦNG BÙN / SÉT ĐÁY LÒNG HỒ (c_u = 20 kPa)</text>

                  {/* Lakebed Pile */}
                  <rect x="770" y="300" width="20" height="110" rx="3" fill="#f59e0b" stroke="#d97706" strokeWidth="2" />
                  <text x="730" y="290" fill="#fbbf24" fontSize="10" fontWeight="bold">CỌC ĐÁY (L=8.0m)</text>

                  {/* Force Arrows */}
                  {/* Wind Force Vector */}
                  <g
                    className="cursor-pointer"
                    onClick={() => setActiveForceInfo('wind')}
                  >
                    <line x1="680" y1="130" x2="615" y2="130" stroke="#ef4444" strokeWidth="4" />
                    <polygon points="615,124 600,130 615,136" fill="#ef4444" />
                    <rect x="670" y="115" width="135" height="28" rx="6" fill="#7f1d1d" stroke="#ef4444" />
                    <text x="680" y="133" fill="#fecaca" fontSize="11" fontWeight="bold">GIÓ BÃO F_wind</text>
                  </g>

                  {/* Lateral Resistance Vector at Shore Pile */}
                  <g
                    className="cursor-pointer"
                    onClick={() => setActiveForceInfo('broms')}
                  >
                    <line x1="70" y1="140" x2="10" y2="140" stroke="#10b981" strokeWidth="4" />
                    <polygon points="15,134 0,140 15,146" fill="#10b981" />
                    <rect x="15" y="100" width="70" height="24" rx="4" fill="#064e3b" stroke="#10b981" />
                    <text x="22" y="116" fill="#a7f3d0" fontSize="10" fontWeight="bold">H_allow</text>
                  </g>

                  {/* Vertical Uplift Vector at Lakebed Pile */}
                  <g
                    className="cursor-pointer"
                    onClick={() => setActiveForceInfo('uplift')}
                  >
                    <line x1="780" y1="280" x2="780" y2="240" stroke="#f59e0b" strokeWidth="3.5" />
                    <polygon points="774,245 780,230 786,245" fill="#f59e0b" />
                    <rect x="795" y="245" width="80" height="24" rx="4" fill="#78350f" stroke="#f59e0b" />
                    <text x="802" y="261" fill="#fde68a" fontSize="10" fontWeight="bold">Lực nhổ T_v</text>
                  </g>
                </svg>
              </div>

              {/* Dynamic Info Panel */}
              <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                {activeForceInfo === 'wind' && (
                  <div className="space-y-1">
                    <div className="font-bold text-rose-400 text-sm flex items-center gap-2">
                      <Wind className="w-4 h-4" />
                      Tải Trọng Gió Bão Tác Dụng Lên Bè (F_wind)
                    </div>
                    <p className="text-slate-300">
                      Gió bão thổi với vận tốc V_wind = 30 m/s tạo áp lực động q = 0.5 x &rho; x V&sup2; = 562.5 Pa. Lực cản tác dụng lên bề mặt dàn pin có xét góc nghiêng 12&deg; và hệ số che chắn &eta; = 0.55, tạo ra tổng lực môi trường F_env = (F_panel + F_float) x 1.05.
                    </p>
                  </div>
                )}

                {activeForceInfo === 'broms' && (
                  <div className="space-y-1">
                    <div className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                      <Anchor className="w-4 h-4" />
                      Sức Chịu Tải Ngang Của Cọc Bờ Theo Broms (H_allow)
                    </div>
                    <p className="text-slate-300">
                      Cọc bê tông cốt thép vuông 0.45m x 0.45m ngàm sâu 6.5m trong tầng đất bờ (c_u = 40 kPa). Đất sinh ra áp lực kháng p_u = 9 x c_u x D, cân bằng với lực kéo cáp T_max với hệ số an toàn FS = 2.5.
                    </p>
                  </div>
                )}

                {activeForceInfo === 'uplift' && (
                  <div className="space-y-1">
                    <div className="font-bold text-amber-400 text-sm flex items-center gap-2">
                      <Scale className="w-4 h-4" />
                      Khả Năng Chống Nhổ Cọc Lòng Hồ (Q_uplift)
                    </div>
                    <p className="text-slate-300">
                      Do cáp neo đáy có góc dốc &theta;, lực kéo sinh ra thành phần hướng đứng T_v = T_max x sin(&theta;). Cọc ngàm 8.0m trong bùn đáy hồ sinh ra sức kháng ma sát thành bên Q_uplift = &alpha; x c_u x (4D) x L, giữ cho cọc không bị nhổ tuột.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: FORMULAS, NUMERICAL EXAMPLES & STANDARDS                          */}
      {/* ========================================================================= */}
      {activeTab === 'formulas' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Formula 1: Wind */}
            <div className="card card-pad space-y-3">
              <div className="flex items-center gap-2 text-brand-700 font-bold text-sm">
                <Wind className="w-4 h-4" />
                <span>1. Tải Trọng Gió Lên Tấm Pin &amp; Phao Nổi</span>
              </div>
              <div className="p-3 bg-slate-900 text-brand-300 rounded-lg font-mono text-xs overflow-x-auto space-y-1">
                <div>q = 0.5 &times; &rho;_air &times; V_wind&sup2;</div>
                <div>F_wind,panel = q &times; C_d &times; A_panel &times; sin(&theta;_tilt) &times; &eta;_shield</div>
                <div>F_env = (F_wind,panel + F_wind,float) &times; 1.05</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-700">
                <span className="font-bold text-slate-900">Ví dụ tính toán mẫu (BÈ 1 Hồ Huổi Vanh):</span>
                <div>• V_wind = 30 m/s, &rho; = 1.25 kg/m&sup3; &rarr; q = 562.5 Pa</div>
                <div>• 790 tấm pin &times; 2.701 m&sup2;, nghiêng 12&deg;, &eta; = 0.55 &rarr; F_env = 202.2 kN</div>
              </div>
            </div>

            {/* Formula 2: Tension */}
            <div className="card card-pad space-y-3">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                <Layers className="w-4 h-4" />
                <span>2. Lực Căng Cáp Lớn Nhất (T_max)</span>
              </div>
              <div className="p-3 bg-slate-900 text-brand-300 rounded-lg font-mono text-xs overflow-x-auto space-y-1">
                <div>T_max = max( F_env &times; k_focus + T_0 ; F_env / (N_eff &times; cos&alpha;) + T_0 )</div>
                <div>Bền nguyên vẹn: SF = MBL / T_max &ge; 3.0</div>
                <div>Đứt 1 dây: SF = MBL / T_max,dam &ge; 2.0</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-700">
                <span className="font-bold text-slate-900">Ví dụ tính toán mẫu (BÈ 1):</span>
                <div>• k_focus = 0.276, T_0 = 5 kN &rarr; T_max = 202.2 &times; 0.276 + 5 = 60.8 kN (phương pháp tập trung tải governs)</div>
                <div>• Chọn cáp <strong>PES-28</strong> (MBL = 235 kN) &rarr; SF = 235 / 60.8 = 3.86 &ge; 3.0 &rarr; Dư an toàn: <strong>+28.8% (ĐẠT)</strong></div>
              </div>
            </div>

            {/* Formula 3: Broms */}
            <div className="card card-pad space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <Anchor className="w-4 h-4" />
                <span>3. Sức Chịu Ngang Cọc Bờ Theo Broms</span>
              </div>
              <div className="p-3 bg-slate-900 text-brand-300 rounded-lg font-mono text-xs overflow-x-auto space-y-1">
                <div>p_u = 9 &times; c_u &times; D (Áp lực đất giới hạn); g = L - 1.5D</div>
                <div>0.5/p_u &times; H_u&sup2; + (e + 1.5D + g) &times; H_u - 0.5 &times; p_u &times; g&sup2; = 0</div>
                <div>H_allow = H_u / FS_pile (FS = 2.5)</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-700">
                <span className="font-bold text-slate-900">Ví dụ tính toán mẫu (Cọc bờ BÈ 1):</span>
                <div>• Cọc vuông D = 0.45m, ngàm L = 6.5m, đất c_u = 40 kPa, tay đòn e = 0.5m</div>
                <div>• p_u = 162 kN/m &rarr; giải PT Broms &rarr; H_u = 341.2 kN &rarr; H_allow = 136.5 kN</div>
                <div>• H_applied = T_max = 60.8 kN &le; 136.5 kN &rarr; <strong>ĐẠT</strong> (dự trữ &asymp; 2.2 lần)</div>
              </div>
            </div>

            {/* Formula 4: Uplift */}
            <div className="card card-pad space-y-3">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <Scale className="w-4 h-4" />
                <span>4. Chống Nhổ Cọc Lòng Hồ &amp; Uốn Cọc</span>
              </div>
              <div className="p-3 bg-slate-900 text-brand-300 rounded-lg font-mono text-xs overflow-x-auto space-y-1">
                <div>T_v = T_max &times; sin(&theta;_line)</div>
                <div>Q_uplift = &alpha; &times; c_u,bed &times; (4D) &times; L_bed (&alpha; = 0.7)</div>
                <div>M_rd = 0.9 &times; R_b &times; (D&sup3; / 6) &ge; M_max</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-700">
                <span className="font-bold text-slate-900">Ví dụ tính toán mẫu (Cọc đáy BÈ 1):</span>
                <div>• Cọc đáy D = 0.35m, ngàm L = 8.0m, bùn c_u = 20 kPa</div>
                <div>• Q_uplift = 0.7 &times; 20 &times; 1.4 &times; 8.0 = 156.8 kN &rarr; Q_allow = 156.8 / 2.0 = 78.4 kN</div>
                <div>• Góc cáp &theta; &asymp; 24&deg; &rarr; T_v = 60.8 &times; sin(24&deg;) = 24.7 kN &le; 78.4 kN &rarr; <strong>ĐẠT</strong></div>
              </div>
            </div>
          </div>

          {/* Standards Reference Card */}
          <div className="card card-pad">
            <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              Các Tiêu Chuẩn Kỹ Thuật Áp Dụng
            </h4>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tiêu chuẩn</th>
                    <th>Cơ quan ban hành</th>
                    <th>Nội dung áp dụng cho phần mềm</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-bold text-brand-900 font-mono">DNV-ST-0119</td>
                    <td>DNV GL (Quốc tế)</td>
                    <td>Quy chuẩn thiết kế hệ neo phao nổi và bè điện mặt trời nổi (FPV).</td>
                  </tr>
                  <tr>
                    <td className="font-bold text-brand-900 font-mono">API RP 2SK</td>
                    <td>American Petroleum Institute</td>
                    <td>Phương pháp phân tích động lực học hệ neo cố định và tổ hợp tải trọng bão.</td>
                  </tr>
                  <tr>
                    <td className="font-bold text-brand-900 font-mono">TCVN 11823 / TCVN 10304</td>
                    <td>Bộ Xây Dựng / Bộ GTVT</td>
                    <td>Tính toán kết cấu bê tông cốt thép và sức chịu tải của cọc ngàm trong đất.</td>
                  </tr>
                  <tr>
                    <td className="font-bold text-brand-900 font-mono">QCVN 02:2022/BXD</td>
                    <td>Bộ Xây Dựng</td>
                    <td>Số liệu điều kiện tự nhiên, phân vùng áp lực gió bão trên lãnh thổ Việt Nam.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: TROUBLESHOOTING & REMEDIATION MATRIX                               */}
      {/* ========================================================================= */}
      {activeTab === 'troubleshooting' && (
        <div className="space-y-6 animate-fade-in">
          <div className="card card-pad">
            <div className="card-header">
              <div>
                <h3 className="card-title flex items-center gap-2 text-rose-600">
                  <AlertTriangle className="w-5 h-5" />
                  Cẩm Nang Chẩn Đoán &amp; Xử Lý Khi Báo "KHÔNG ĐẠT"
                </h3>
                <p className="card-subtitle">
                  Tra cứu giải pháp điều chỉnh thông số nhanh chóng theo từng mã kiểm tra bị vi phạm
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Item C1 & C7 */}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono font-bold text-xs">
                      C1 / C7
                    </span>
                    <span className="font-bold text-rose-950 text-sm">
                      Sức chịu tải ngang hoặc Mômen cọc bờ KHÔNG ĐẠT
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectSection('input')}
                    className="text-xs font-bold text-rose-700 hover:text-rose-900 underline"
                  >
                    Chỉnh Cọc Bờ &rarr;
                  </button>
                </div>
                <p className="text-xs text-rose-900 leading-relaxed">
                  <strong>Nguyên nhân:</strong> Lực kéo cáp ngang lớn hơn sức chịu tải ngang H_allow của cọc bờ theo Broms hoặc mômen uốn M_max &gt; M_rd.<br />
                  <strong>Giải pháp khắc phục:</strong>
                </p>
                <ul className="list-disc pl-5 text-xs text-rose-900 space-y-1">
                  <li>Tăng kích thước cạnh cọc vuông D (ví dụ từ 0.40m lên 0.45m hoặc 0.50m). Tiết diện lớn hơn giúp tăng đáng kể diện tích cản đất và mômen chống uốn (W ~ D&sup3;).</li>
                  <li>Tăng chiều sâu ngàm cọc bờ L (ví dụ từ 5.0m lên 6.5m ~ 8.0m).</li>
                  <li>Tăng thêm số lượng dây neo bờ để phân tán lực kéo sang nhiều cọc hơn.</li>
                </ul>
              </div>

              {/* Item C2 & C6 */}
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-600 text-white font-mono font-bold text-xs">
                      C2 / C6
                    </span>
                    <span className="font-bold text-amber-950 text-sm">
                      Sức bền kéo đứt dây cáp KHÔNG ĐẠT
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectSection('input')}
                    className="text-xs font-bold text-amber-700 hover:text-amber-900 underline"
                  >
                    Chỉnh Dây Cáp &rarr;
                  </button>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  <strong>Nguyên nhân:</strong> Lực căng lớn nhất T_max vượt quá sức kéo cho phép (MBL / 3.0 khi nguyên vẹn hoặc MBL / 2.0 khi đứt 1 dây).<br />
                  <strong>Giải pháp khắc phục:</strong>
                </p>
                <ul className="list-disc pl-5 text-xs text-amber-900 space-y-1">
                  <li>Vào mục <strong>Dây Cáp</strong> và bấm chọn mã cáp có đường kính lớn hơn (ví dụ nâng từ <code>PES-24</code> lên <code>PES-28</code>, <code>PES-32</code> hoặc <code>PES-36</code>).</li>
                  <li>Tăng tổng số lượng dây neo trong cụm bè.</li>
                  <li>Kiểm tra lại góc nghiêng tấm pin &theta; hoặc giảm bớt diện tích đón gió nếu cho phép.</li>
                </ul>
              </div>

              {/* Item C5 */}
              <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-sky-600 text-white font-mono font-bold text-xs">
                      C5
                    </span>
                    <span className="font-bold text-sky-950 text-sm">
                      Cọc neo lòng hồ bị nhổ do lực kéo đứng (T_v &gt; T_v,allow)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectSection('input')}
                    className="text-xs font-bold text-sky-700 hover:text-sky-900 underline"
                  >
                    Chỉnh Cọc Đáy &rarr;
                  </button>
                </div>
                <p className="text-xs text-sky-900 leading-relaxed">
                  <strong>Nguyên nhân:</strong> Dây cáp neo đáy quá dốc (khoảng cách từ mép bè tới cọc quá gần) khiến thành phần lực đứng T_v = T_max x sin(&theta;) vượt quá ma sát bám dính của bùn đáy hồ.<br />
                  <strong>Giải pháp khắc phục:</strong>
                </p>
                <ul className="list-disc pl-5 text-xs text-sky-900 space-y-1">
                  <li>Tăng chiều sâu ngàm cọc lòng hồ L_bed (ví dụ từ 6.0m lên 8.0m ~ 10.0m). Ma sát thành cọc tăng tuyến tính theo chiều sâu ngàm (Q ~ 4D x L).</li>
                  <li>Kéo dài khoảng cách từ mép bè tới vị trí đóng cọc đáy lòng hồ để làm thoải góc dốc cáp &theta; (giúp sin(&theta;) nhỏ lại).</li>
                  <li>Tăng tiết diện cọc đáy từ 0.30m lên 0.35m ~ 0.40m.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: FAQ ACCORDION                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'faq' && (
        <div className="space-y-6 animate-fade-in">
          <div className="card card-pad">
            <div className="card-header">
              <div>
                <h3 className="card-title flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-brand-600" />
                  Các Câu Hỏi Thường Gặp (FAQ)
                </h3>
                <p className="card-subtitle">
                  Giải đáp các thắc mắc thường gặp trong quá trình vận hành, nhập liệu và kiểm tra an toàn hệ neo
                </p>
              </div>

              {/* Search in FAQ */}
              <div className="relative w-64 max-w-full">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm câu hỏi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                />
              </div>
            </div>

            <div className="space-y-3">
              {filteredFaq.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Không tìm thấy câu hỏi phù hợp với từ khóa "{searchQuery}"
                </div>
              ) : (
                filteredFaq.map((faq, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div
                      key={idx}
                      className="border border-slate-200 rounded-xl overflow-hidden transition-all bg-white"
                    >
                      <button
                        type="button"
                        onClick={() => toggleFaq(idx)}
                        className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                      >
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          {faq.q}
                        </span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50 whitespace-pre-line">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
