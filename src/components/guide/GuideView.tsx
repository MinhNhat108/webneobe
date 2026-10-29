import React, { useState, useMemo } from 'react';
import { ActiveSection } from '../layout/Sidebar';
import { ACTIVE_LAKE, ACTIVE_LAKE_ID } from '../../data/lakes';
import { buildGuideFacts } from './guideFacts';
import {
  BookOpen,
  FolderKanban,
  SlidersHorizontal,
  Map,
  Calculator,
  Paperclip,
  Printer,
  DraftingCompass,
  FileSpreadsheet,
  Table,
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
  Compass,
  Wrench,
  Waves,
  CheckCircle2,
  AlertOctagon
} from 'lucide-react';

interface GuideViewProps {
  onSelectSection: (section: ActiveSection) => void;
  /** Opening tab / step (default: field installation, step 1). */
  initialTab?: GuideTab;
  initialStep?: number;
}

export type GuideTab = 'overview' | 'steps' | 'diagram' | 'formulas' | 'installation' | 'troubleshooting' | 'faq';

export const GuideView: React.FC<GuideViewProps> = ({ onSelectSection, initialTab = 'installation', initialStep = 1 }) => {
  const [activeTab, setActiveTab] = useState<GuideTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [selectedStep, setSelectedStep] = useState<number>(initialStep);
  const [activeForceInfo, setActiveForceInfo] = useState<string | null>('wind');
  // every number of the page comes from the current design (owner 2026-10-29: no more 9-raft examples)
  const F = useMemo(buildGuideFacts, []);
  const E = F.example;
  const C = F.counts;
  const n = (v: number, d = 1) => v.toFixed(d).replace('.', ',');
  const raftList = F.rafts.join(', ');
  const L = F.levels;
  const shoreLines = F.cut.shore.count, bedLines = F.cut.bed.count;
  const note = (id: string) => E.check(id)?.note ?? '';
  const util = (id: string) => n(E.check(id)?.utilization ?? 0, 2);

  // FAQ list
  const faqList = [
    {
      q: 'Khi căng cáp thì cho cáp căng hay chùng dây như thế nào theo các mùa nước hồ?',
      a: `• ĐIỀU KIỆN BẮT BUỘC CỦA THIẾT KẾ: lực dây tính theo mô hình cân bằng ở mọi mực nước với điều kiện ${F.adjustStep_m > 0 ? `CHỈNH LẠI MỌI DÂY CHO VỪA CĂNG MỖI KHI MỰC NƯỚC ĐỔI ${n(F.adjustStep_m, 0)} m` : 'mọi dây luôn được giữ vừa căng (thiết bị bù mực nước)'}. Cắt cáp một lần rồi để nguyên thì lực dây vượt nhiều so với thiết kế.
• Không kéo căng cứng như dây đàn: dây chỉ cần vừa căng (lực căng trước T₀ = ${n(E.pretension_kN, 0)} kN).
• DÂY ĐÁY (${bedLines} dây vào ${C.bedBases} đế, ${C.sharedBases} đế dùng chung): dài nhất khi nước cao — ${F.cut.bedGovernedHigh}/${bedLines} dây dài nhất ở MNLKT ${n(L.mnlkt)} m, nên chiều dài cắt lấy theo MNLKT. Ở MNC ${n(L.mnc)} m dây đáy chùng tới ${n(F.cut.bed.slackLow.max, 2)} m.
• DÂY BỜ (${shoreLines} dây vào cọc khoan nhồi D350): chốt cọc ở trên bờ (${n(F.cut.shore.pin.min, 1)}–${n(F.cut.shore.pin.max, 1)} m) nên dây bờ dài nhất khi nước xuống MNC — ${F.cut.shoreGovernedLow}/${shoreLines} dây cắt theo MNC. Ở MNDB dây bờ chùng ${n(F.cut.shore.slackNormal.min, 2)}–${n(F.cut.shore.slackNormal.max, 2)} m (trung vị ${n(F.cut.shore.slackNormal.med, 2)} m).
• Chiều dài cắt từng dây: sheet ChieuDaiCatCap của bảng neo Excel (chốt tới chốt, chưa gồm phụ kiện đầu dây). Đầu bích bè dùng xích / tăng đơ để chỉnh dây theo mực nước.`
    },
    {
      q: 'Khi bảng kết quả báo "KHÔNG ĐẠT" (Màu đỏ), tôi cần điều chỉnh thông số nào trước?',
      a: 'Hãy nhìn vào dòng "Hạng mục vi phạm" trên thanh kết luận:\n• Nếu vi phạm sức bền kéo cáp (C2 hoặc C6): Vào mục "2. Thông Số Đầu Vào" -> Tab Dây Cáp -> Chọn mã cáp lớn hơn (ví dụ nâng từ PES-28 lên PES-32 hoặc PES-36) hoặc tăng thêm số lượng dây neo.\n• Nếu vi phạm cọc bờ (BP-1 sức chịu ngang hoặc BP-2 uốn): Vào tab Cọc & Neo -> tăng chiều sâu cọc L, tăng thép chủ / mác thép lồng cọc D350, hoặc dùng cọc đôi.\n• Nếu vi phạm neo đáy lòng hồ: Với phương án đế vít xoắn (PA3), hệ thống tự động tăng kích thước cạnh đế B và chiều dài vít L để đạt 100%; nếu đế đã lớn mà vẫn không đạt thì dời đế xa bè để dây thoải hơn và khảo sát lại c_u bùn đáy.'
    },
    {
      q: 'Dữ liệu tôi nhập có bị mất khi đóng trình duyệt hay tải lại trang web không?',
      a: 'Không bị mất. Toàn bộ thông số dự án, dữ liệu hình học bè, môi trường, cáp và cọc được tự động lưu tức thì (Auto-save) vào LocalStorage của trình duyệt máy bạn. Khi bạn mở lại trang web, mọi thông số sẽ giữ nguyên trạng thái làm việc gần nhất.'
    },
    {
      q: `Làm thế nào để khôi phục lại dữ liệu chuẩn ban đầu của dự án ${ACTIVE_LAKE.name}?`,
      a: `Vào mục "1. Dự Án & Cụm Bè" ở menu trái, sau đó nhấn nút "Dữ liệu gốc" (có biểu tượng làm mới). Phần mềm nạp lại thông số thiết kế của ${F.rafts.length} bè (${raftList}) theo mặt bằng hiện hành.`
    },
    {
      q: 'Làm sao để xuất hoặc in báo cáo thuyết minh tính toán sang file PDF đẹp mắt?',
      a: 'Bạn có thể nhấn nút "In Báo Cáo" trên thanh Header hoặc chọn mục "6. Báo Cáo Kỹ Thuật" ở menu trái. Trên màn hình thuyết minh, nhấn nút "In Thuyết Minh / Xuất PDF" (hoặc bấm tổ hợp phím Ctrl + P). Trong hộp thoại in của trình duyệt, chọn "Lưu dưới dạng PDF" (Save as PDF) với khổ giấy A4 dọc.'
    },
    {
      q: 'Lực căng dây T được tính như thế nào?',
      a: `Bằng mô hình CÂN BẰNG TĨNH theo mực nước: bè tịnh tiến dưới lực gió F_env theo 24 hướng, ở mọi mực nước từ khi bè nổi tới MNLKT; mỗi dây là dây thẳng đàn hồi (EA = 15 × MBL, giả định), dây chùng không chịu lực. Lấy T = max(lực dây lớn nhất + T₀ ; F_env / (6·cos 30°)). Đứt một dây: ở từng mực nước bỏ dây chịu lớn nhất rồi tính lại. Ví dụ ${E.raft}: F_env = ${n(E.fEnv_kN)} kN, dây lớn nhất ${n(E.eq_kN)} kN + T₀ ${n(E.pretension_kN, 0)} kN = ${n(E.t_kN)} kN (sàn ${n(E.floor_kN)} kN ${E.eq_kN + E.pretension_kN >= E.floor_kN ? 'không chi phối' : 'chi phối'}). Hệ số k_focus của cách tính cũ không còn dùng.`
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
      <div className="p-3 rounded-xl border border-sky-200 bg-sky-50 text-xs text-sky-900">
        Số liệu trong hướng dẫn lấy trực tiếp từ thiết kế hiện hành của {ACTIVE_LAKE.name}: {F.rafts.length} bè ({raftList}), {C.lines} tuyến cáp,
        {' '}{C.anchorPoints} điểm neo ({C.shorePoints} điểm cọc bờ, {C.bedBases} đế đáy{C.ties ? `, ${C.ties} dây nối hai bè` : ''}); gió {n(F.wind_ms, 0)} m/s, tấm pin nghiêng {n(F.tilt_deg, 0)}°; MNC {n(L.mnc)} / MNDB {n(L.mndb)} / MNLKT {n(L.mnlkt)} m.
        {ACTIVE_LAKE_ID !== 'huoi-vanh' && ' Phần chỉ dẫn thi công (cắt cáp, chỉnh dây) viết cho Huổi Vanh; Bản Mòng dùng thiết bị bù mực nước — xem cảnh báo ở thanh trên cùng.'}
      </div>
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
            { id: 'installation' as GuideTab, label: '5. Thi Công & Căng Cáp Hiện Trường', icon: Anchor },
            { id: 'troubleshooting' as GuideTab, label: '6. Cẩm Nang Xử Lý Lỗi', icon: Lightbulb },
            { id: 'faq' as GuideTab, label: '7. Câu Hỏi Thường Gặp', icon: HelpCircle },
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
                    Chọn nhanh từ <strong>{F.rafts.length} bè ({raftList})</strong> của {ACTIVE_LAKE.name} hoặc tạo dự án mới, tự động nạp diện tích, số tấm pin và sơ đồ cáp.
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
                    Khai báo kích thước bè, vận tốc gió V_wind (mặc định {n(F.wind_ms, 0)} m/s), mã cáp Polyester (PES-24 đến PES-48), cọc khoan nhồi bờ và đế neo đáy.
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
                    Bản đồ số hóa {C.lines} tuyến cáp tại {C.anchorPoints} điểm neo ({C.shorePoints} điểm cọc khoan nhồi bờ &amp; {C.bedBases} đế vít xoắn đáy hồ, {C.sharedBases} đế dùng chung hai bè), tra cứu tọa độ thực tế X, Y, Z, chiều dài nhịp cáp và góc nghiêng tuyến kéo.
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
                    Kiểm tra các tiêu chí bắt buộc: bền cáp nguyên vẹn &amp; đứt 1 dây (C2, C6), cọc bờ Broms + uốn (BP-1, BP-2), đế vít xoắn (SV-1…SV-6), khoảng cách dây (C9), độ trôi (C12) &amp; mômen uốn.
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
                    Khởi tạo hồ sơ công trình và chọn cụm bè trong {F.rafts.length} bè của {ACTIVE_LAKE.name}
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
                      <strong>Chọn cụm bè ({F.rafts.length} bè: {raftList}):</strong> Thanh nút bấm trên đầu trang cho phép chuyển đổi tức thì giữa các cụm bè. Khi chọn bè nào, toàn bộ kích thước hình học (L x W), số tấm pin, mã cáp và số dây neo của cụm bè đó sẽ được nạp tự động.
                    </li>
                    <li>
                      <strong>Nút "Dữ liệu gốc":</strong> Nhấn nút này khi muốn hủy bỏ các chỉnh sửa thử nghiệm để khôi phục cấu hình chuẩn ban đầu theo hồ sơ thiết kế.
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
                    • Số lượng tấm pin, Diện tích 1 tấm (A = {n(F.panelArea_m2, 3)} m&sup2;), Góc nghiêng pin (&theta; = {n(F.tilt_deg, 0)}&deg;), Hệ số che chắn (&eta; = 0,55).<br />
                    • Vị trí, tầm và cao độ chốt từng dây lấy từ mặt bằng neo (không nhập tay).
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Wind className="w-4 h-4 text-sky-600" />
                    2. Môi trường &amp; Khí tượng (EnvForm)
                  </h4>
                  <p>
                    • Độ sâu nước lớn nhất tại vị trí cụm bè (h, m).<br />
                    • Vận tốc gió (V_wind): mặc định {n(F.wind_ms, 0)} m/s theo Chủ đầu tư — THẤP HƠN gió tiêu chuẩn TCVN 2737:2023; kiểm tra bão thì nhập 30 m/s.<br />
                    • Vận tốc dòng chảy (V_current) và Chiều cao sóng (H_s).<br />
                    • Hệ số tổ hợp sóng + dòng chảy với gió (1,05).
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
                    • Cách giữ dây theo mực nước: {F.adjustStep_m > 0 ? `chỉnh lại dây mỗi ${n(F.adjustStep_m, 0)} m mực nước (Huổi Vanh, bắt buộc)` : 'thiết bị bù mực nước + khóa bão'}; độ cứng cáp EA = 15 × MBL (giả định).<br />
                    • Số dây bờ / dây đáy của bè lấy từ mặt bằng neo.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Anchor className="w-4 h-4 text-emerald-600" />
                    4. Cọc Neo Đất Broms (AnchorForm)
                  </h4>
                  <p>
                    • Bờ: cọc khoan nhồi tròn D{E.shorePile.D_mm}, sâu L = {n(E.shorePile.L_m)} m, lồng thép theo bè (ví dụ {E.raft}: {E.shorePile.cage}).<br />
                    • Đáy: đế BTCT + 4 vít xoắn (phương án chốt), cạnh đế tự tăng tới khi đạt.<br />
                    • c_u đất bờ {n(E.shorePile.cu_kPa, 0)} kPa, c_u bùn đáy {E.base ? n(E.base.cu_kPa, 0) : '20'} kPa — GIẢ ĐỊNH, chưa khảo sát.<br />
                    • Uốn cọc: γ·M_max ≤ M_rd với γ = 1,2 (TCVN 5574:2018).
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
                    Xem &amp; Khai Thác Bản Đồ Mặt Bằng Tọa Độ {C.anchorPoints} Điểm Neo ({C.lines} Tuyến Cáp)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Trực quan hóa vị trí thực địa của {F.rafts.length} bè và hệ thống neo {ACTIVE_LAKE.name}
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
                      Cọc Khoan Nhồi Bờ (Màu Xanh Lá)
                    </div>
                    <p className="text-emerald-800">
                      {C.shorePoints} điểm cọc khoan nhồi D350 trên bờ: chỗ nào neo bờ được thì dùng cọc bờ. Cáp móc sát cổ cọc (tim chốt cách mặt đất ≤ 100 mm).
                    </p>
                  </div>

                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                    <div className="font-bold text-amber-900 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                      Đế Neo Đáy Hồ (Màu Cam)
                    </div>
                    <p className="text-amber-800">
                      {C.bedBases} đế BTCT + vít xoắn dưới đáy hồ, chỉ ở chỗ không neo bờ được: {C.sharedBases} đế dùng chung đặt giữa khe hai bè (hai tai neo, mỗi tai một dây), còn lại là đế đơn.
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
                    Đánh Giá Kết Quả Tính Toán &amp; Các Tiêu Chí An Toàn
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Huy hiệu kết luận tổng thể ĐẠT/KHÔNG ĐẠT và bảng kiểm tra từng điều kiện (giá trị ví dụ của {E.raft})
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
                    A. Phương Án Chốt: Cọc Khoan Nhồi Bờ + Đế BTCT Vít Xoắn
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
                          <td className="font-medium text-slate-800">Bền cáp PES (nguyên vẹn)</td>
                          <td className="font-mono">{E.check('C2')?.formula}</td>
                          <td>{util('C2')} — {note('C2')}</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-brand-700">C6</td>
                          <td className="font-medium text-slate-800">Bền cáp PES (đứt 1 dây)</td>
                          <td className="font-mono">{E.check('C6')?.formula}</td>
                          <td>{util('C6')} — {note('C6')}</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-brand-700">C9</td>
                          <td className="font-medium text-slate-800">Khoảng cách trung bình giữa các dây</td>
                          <td className="font-mono">{E.check('C9')?.formula}</td>
                          <td>{util('C9')} — {note('C9')}</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-brand-700">C12</td>
                          <td className="font-medium text-slate-800">Độ trôi ngang của bè</td>
                          <td className="font-mono">{E.check('C12')?.formula}</td>
                          <td>{util('C12')} — {note('C12')}</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-emerald-700">BP-1</td>
                          <td className="font-medium text-slate-800">Sức chịu ngang cọc BỜ (Broms)</td>
                          <td className="font-mono">{E.check('BP-1')?.formula}</td>
                          <td>{util('BP-1')} — {note('BP-1')}</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-emerald-700">BP-2</td>
                          <td className="font-medium text-slate-800">Uốn tiết diện cọc BỜ (TCVN 5574:2018)</td>
                          <td className="font-mono">{E.check('BP-2')?.formula}</td>
                          <td>{util('BP-2')} — {note('BP-2')}</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-amber-700">SV-1</td>
                          <td className="font-medium text-slate-800">Đế vít xoắn — chống nhổ</td>
                          <td className="font-mono">{E.check('SV-1')?.formula}</td>
                          <td>{util('SV-1')} — {note('SV-1')}</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-amber-700">SV-2</td>
                          <td className="font-medium text-slate-800">Đế vít xoắn — chống trượt</td>
                          <td className="font-mono">{E.check('SV-2')?.formula}</td>
                          <td>{util('SV-2')} — {note('SV-2')}</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-amber-700">SV-3</td>
                          <td className="font-medium text-slate-800">Đế vít xoắn — chống lật</td>
                          <td className="font-mono">{E.check('SV-3')?.formula}</td>
                          <td>{util('SV-3')} — {note('SV-3')}</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-amber-700">SV-4</td>
                          <td className="font-medium text-slate-800">Đế vít xoắn — lực nhổ một vít</td>
                          <td className="font-mono">{E.check('SV-4')?.formula}</td>
                          <td>{util('SV-4')} — {note('SV-4')}</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-amber-700">SV-5</td>
                          <td className="font-medium text-slate-800">Đế vít xoắn — áp lực lên nền bùn</td>
                          <td className="font-mono">{E.check('SV-5')?.formula}</td>
                          <td>{util('SV-5')} — {note('SV-5')}</td>
                        </tr>
                        <tr>
                          <td className="font-mono font-bold text-amber-700">SV-6</td>
                          <td className="font-medium text-slate-800">Đế vít xoắn — cốt thép bản đế</td>
                          <td className="font-mono">{E.check('SV-6')?.formula}</td>
                          <td>{util('SV-6')} — {note('SV-6')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2 text-slate-600">
                    B. Chỉ Áp Dụng Cho Mỏ Neo Kéo / Neo Trọng Lực (không dùng cho phương án chốt — hiện &quot;Không áp dụng&quot;)
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
                    Vẽ trực tiếp file DXF lên Canvas. Hỗ trợ phóng to, thu nhỏ, di chuyển bản vẽ mặt bằng hệ neo {F.rafts.length} bè.
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
                    Bảng Tính Phương Án Chốt (Excel)
                  </h4>
                  <p className="text-slate-600">
                    Bấm nút <strong>"Bảng Tính"</strong> trên Header: thuyết minh, thông số, lực dây, cọc khoan nhồi theo bè và từng cọc, đế neo từng đế,
                    vít xoắn, khối lượng – báo giá, chiều dài cắt cáp và <strong>cân bằng neo theo mực nước</strong> — cùng số liệu với mục thuyết minh ở tab Báo cáo.
                  </p>
                </div>

                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <DraftingCompass className="w-4 h-4 text-amber-600" />
                    Xuất Bản Vẽ Mặt Bằng Hệ Neo (.DXF)
                  </h4>
                  <p className="text-slate-600">
                    Bấm nút <strong>"Xuất CAD"</strong> trên Header: đường bao các bè, tuyến cáp, cọc bờ ký hiệu <strong>C1, C2…</strong> và đế đáy
                    ký hiệu <strong>D1, D2…</strong> tại đúng tọa độ, đế vẽ đúng kích thước, kèm bảng thống kê cọc bờ và đế (cột KH BV tra mã cọc / mã đế).
                    Chữ tiếng Việt có dấu, mở trực tiếp bằng AutoCAD.
                  </p>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Table className="w-4 h-4 text-emerald-600" />
                    Xuất Bảng Neo (.xlsx)
                  </h4>
                  <p className="text-slate-600">
                    Bấm nút <strong>"Bảng Neo Excel"</strong> trên Header hoặc nút <strong>"Xuất Excel Bảng Neo"</strong> tại mục "3. Mặt Bằng &amp; Tọa Độ Neo" để tải bảng {C.anchorPoints} điểm neo cùng số liệu với bản vẽ CAD: thống kê cọc bờ, thống kê đế, đế theo bè, tính từng điểm neo đáy / bờ và chiều dài cắt cáp từng dây.
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
                  <text x="30" y="160" fill="#94a3b8" fontSize="11" fontWeight="bold">TALUY BỜ ĐẤT (c_u = {n(E.shorePile.cu_kPa, 0)} kPa, giả định)</text>

                  {/* Shore Pile */}
                  <rect x="90" y="120" width="24" height="150" rx="3" fill="#10b981" stroke="#059669" strokeWidth="2" />
                  <text x="75" y="105" fill="#34d399" fontSize="11" fontWeight="bold">CỌC KHOAN NHỒI D{E.shorePile.D_mm}, L={n(E.shorePile.L_m)} m</text>

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
                    <text x="50" y="-2" fill="#fbbf24" fontSize="11" fontWeight="bold">DÀN PIN MẶT TRỜI (Góc nghiêng {n(F.tilt_deg, 0)}°)</text>
                  </g>

                  {/* Mooring Cable to Shore */}
                  <path d="M 114,140 Q 230,175 360,190" fill="none" stroke="#38bdf8" strokeWidth="3.5" strokeDasharray="6 3" />
                  <text x="210" y="160" fill="#7dd3fc" fontSize="11" fontWeight="bold">Cáp {E.cable} ({E.raft}: T = {n(E.t_kN)} kN)</text>

                  {/* Mooring Cable to Lakebed */}
                  <path d="M 600,190 Q 720,260 780,330" fill="none" stroke="#f97316" strokeWidth="3" strokeDasharray="5 3" />
                  <text x="670" y="240" fill="#fdba74" fontSize="11" fontWeight="bold">Cáp neo đáy (Góc θ)</text>

                  {/* Lakebed Soil */}
                  <rect x="180" y="340" width="720" height="80" fill="#1e293b" />
                  <text x="400" y="385" fill="#64748b" fontSize="11" fontWeight="bold">BÙN ĐÁY HỒ (c_u = {E.base ? n(E.base.cu_kPa, 0) : 20} kPa, giả định)</text>

                  {/* Lakebed Pile */}
                  <rect x="745" y="326" width="70" height="14" rx="2" fill="#f59e0b" stroke="#d97706" strokeWidth="2" />
                  <text x="705" y="300" fill="#fbbf24" fontSize="10" fontWeight="bold">ĐẾ BTCT + VÍT XOẮN</text>

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
                      Gió V = {n(F.wind_ms, 0)} m/s tạo áp lực q = 0,5 &times; &rho; &times; V&sup2; = {n(E.q_Pa, 0)} Pa. Lực cản lên dàn pin xét góc nghiêng {n(F.tilt_deg, 0)}&deg; và hệ số che chắn &eta; = 0,55; tổng lực môi trường F_env = (F_pin + F_phao) &times; 1,05 ({E.raft}: {n(E.fEnv_kN)} kN).
                    </p>
                  </div>
                )}

                {activeForceInfo === 'broms' && (
                  <div className="space-y-1">
                    <div className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                      <Anchor className="w-4 h-4" />
                      Sức Chịu Tải Ngang Và Uốn Của Cọc Bờ (Broms + TCVN 5574:2018)
                    </div>
                    <p className="text-slate-300">
                      Cọc khoan nhồi tròn D{E.shorePile.D_mm} sâu {n(E.shorePile.L_m)} m trong đất bờ (c_u = {n(E.shorePile.cu_kPa, 0)} kPa). Đất sinh áp lực kháng p_u = 9 &times; c_u &times; D (Broms); thân cọc kiểm tra uốn γ·M_max ≤ M_rd với lồng thép ở hướng bất lợi nhất. Cáp móc sát cổ cọc (tim chốt cách mặt đất ≤ 100 mm).
                    </p>
                  </div>
                )}

                {activeForceInfo === 'uplift' && (
                  <div className="space-y-1">
                    <div className="font-bold text-amber-400 text-sm flex items-center gap-2">
                      <Scale className="w-4 h-4" />
                      Đế BTCT + Vít Xoắn Dưới Đáy Hồ: Chống Nhổ, Trượt, Lật
                    </div>
                    <p className="text-slate-300">
                      Dây đáy dốc góc &theta; nên có thành phần nhổ T_v = T &times; sin &theta; (lớn nhất khi nước cao) và thành phần ngang T_h (lớn nhất khi nước thấp). Đế giữ bằng trọng lượng đẩy nổi 0,9·W' cộng sức nhổ của 4 vít xoắn (SV-1), bám dính đáy + gờ chống trượt + vít (SV-2), chống lật (SV-3); cạnh đế B tự tăng tới khi đạt.
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
                <span className="font-bold text-slate-900">Ví dụ tính toán ({E.raft} {ACTIVE_LAKE.name}):</span>
                <div>• V_wind = {n(F.wind_ms, 0)} m/s, &rho; = 1,25 kg/m&sup3; &rarr; q = {n(E.q_Pa, 0)} Pa</div>
                <div>• {E.panels.toLocaleString('vi-VN')} tấm &times; {n(F.panelArea_m2, 3)} m&sup2;, nghiêng {n(F.tilt_deg, 0)}&deg;, &eta; = 0,55 &rarr; F_pin = {n(E.fPanel_kN)} kN; F_phao = {n(E.fFloat_kN)} kN</div>
                <div>• F_env = ({n(E.fPanel_kN)} + {n(E.fFloat_kN)}) &times; 1,05 = {n(E.fEnv_kN)} kN</div>
              </div>
            </div>

            {/* Formula 2: Tension */}
            <div className="card card-pad space-y-3">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                <Layers className="w-4 h-4" />
                <span>2. Lực Căng Cáp Lớn Nhất (cân bằng tĩnh theo mực nước)</span>
              </div>
              <div className="p-3 bg-slate-900 text-brand-300 rounded-lg font-mono text-xs overflow-x-auto space-y-1">
                <div>Bè tịnh tiến tới cân bằng dưới F_env, 24 hướng gió, mọi mực nước; dây thẳng đàn hồi EA = 15 &times; MBL</div>
                <div>T_max = max( T_cân bằng + T_0 ; F_env / (6 &times; cos 30&deg;) )</div>
                <div>Bền nguyên vẹn: SF = MBL / T_max &ge; 3.0</div>
                <div>Đứt 1 dây: SF = MBL / T_max,dam &ge; 2.0</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-700">
                <span className="font-bold text-slate-900">Ví dụ tính toán ({E.raft}):</span>
                <div>• Dây lớn nhất trong cân bằng {n(E.eq_kN)} kN + T_0 = {n(E.pretension_kN, 0)} kN &rarr; {n(E.eq_kN + E.pretension_kN)} kN; sàn F_env / (6 cos 30&deg;) = {n(E.floor_kN)} kN &rarr; T_max = {n(E.t_kN)} kN</div>
                <div>• Cáp <strong>{E.cable}</strong> (MBL = {n(E.mbl_kN, 0)} kN) &rarr; SF = {n(E.mbl_kN / E.t_kN, 2)} &ge; 3,0 (C2 ĐẠT); đứt 1 dây: T = {n(E.tDamaged_kN)} kN, SF = {n(E.mbl_kN / E.tDamaged_kN, 2)} &ge; 2,0 (C6)</div>
              </div>
            </div>

            {/* Formula 3: Broms */}
            <div className="card card-pad space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <Anchor className="w-4 h-4" />
                <span>3. Cọc Khoan Nhồi Bờ: Broms + Uốn Tiết Diện</span>
              </div>
              <div className="p-3 bg-slate-900 text-brand-300 rounded-lg font-mono text-xs overflow-x-auto space-y-1">
                <div>p_u = 9 &times; c_u &times; D (Áp lực đất giới hạn); g = L - 1.5D</div>
                <div>0.5/p_u &times; H_u&sup2; + (e + 1.5D + g) &times; H_u - 0.5 &times; p_u &times; g&sup2; = 0</div>
                <div>P_max = min( sức chịu ngang Broms ; lực gây γ·M_max = M_rd ), γ = 1,2</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-700">
                <span className="font-bold text-slate-900">Ví dụ tính toán (cọc bờ {E.raft}):</span>
                <div>• Cọc tròn D{E.shorePile.D_mm}, L = {n(E.shorePile.L_m)} m, lồng {E.shorePile.cage}, c_u = {n(E.shorePile.cu_kPa, 0)} kPa, tay đòn e = 0,1 m</div>
                <div>• P_max theo đất = {n(E.shorePile.pLateral_kN)} kN; theo uốn = {n(E.shorePile.pMoment_kN)} kN</div>
                <div>• BP-1 = {util('BP-1')}; BP-2 = {util('BP-2')} ({note('BP-2')})</div>
              </div>
            </div>

            {/* Formula 4: Uplift */}
            <div className="card card-pad space-y-3">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <Scale className="w-4 h-4" />
                <span>4. Đế BTCT + Vít Xoắn Dưới Đáy Hồ</span>
              </div>
              <div className="p-3 bg-slate-900 text-brand-300 rounded-lg font-mono text-xs overflow-x-auto space-y-1">
                <div>T_v = T &times; sin &theta;, T_h = T &times; cos &theta; (hai mực nước: thấp &rarr; trượt, cao &rarr; nhổ)</div>
                <div>SV-1: T_v &le; 0,9&middot;W' + n&middot;Q_a &nbsp;|&nbsp; SV-2: 1,5&middot;T_h &le; &alpha;&middot;c_u&middot;B&sup2; + R_gờ + n&middot;H_u</div>
                <div>SV-3 lật, SV-4 một vít, SV-5 nền W'/B&sup2; &le; 5,14&middot;c_u/2,5, SV-6 thép bản đế</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-700">
                <span className="font-bold text-slate-900">Ví dụ tính toán (đế kiểm tra theo bè {E.raft}):</span>
                {E.base ? <div>• Đế {n(E.base.side_m, 2)} &times; {n(E.base.side_m, 2)} &times; {n(E.base.thickness_m, 2)} m, {E.base.screws} vít dài {n(E.base.screwL_m, 1)} m, bùn c_u = {n(E.base.cu_kPa, 0)} kPa</div> : <div>• Bè này không có dây đáy.</div>}
                <div>• SV-1 = {util('SV-1')} ({note('SV-1')})</div>
                <div>• SV-2 = {util('SV-2')}; SV-3 = {util('SV-3')}; SV-5 = {util('SV-5')}</div>
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
                    <td className="font-bold text-brand-900 font-mono">TCVN 5574:2018 / TCVN 2737:2023</td>
                    <td>Bộ Khoa học và Công nghệ</td>
                    <td>Uốn tiết diện cọc khoan nhồi bê tông cốt thép; tải trọng gió (gió tiêu chuẩn vùng II-B ≈ 29,7 m/s).</td>
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
      {/* TAB 5: FIELD INSTALLATION & MOORING TENSIONING MANUAL                     */}
      {/* ========================================================================= */}
      {activeTab === 'installation' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Banner */}
          <div className="card card-pad bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 text-white border-brand-800/40 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-semibold">
                  <Anchor className="w-3.5 h-3.5 text-brand-400" />
                  <span>Quy Chuẩn Thi Công Ngoài Hiện Trường · {ACTIVE_LAKE.name}</span>
                </div>
                <h3 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-amber-400" />
                  Chỉ Dẫn Thi Công Căng Cáp, Cắt Cáp &amp; Vận Hành Hệ Neo
                </h3>
                <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                  Nguyên lý căng / chùng cáp theo biên độ dao động mực nước hồ <strong>{n(L.mnlkt - L.mnc)} m</strong> (MNC {n(L.mnc)} m &rarr; MNDB {n(L.mndb)} m &rarr; MNLKT {n(L.mnlkt)} m) và chỉ dẫn lắp đặt cho <strong>{C.lines} tuyến cáp</strong> ({shoreLines} dây cọc bờ &amp; {bedLines} dây vào {C.bedBases} đế neo đáy, {C.sharedBases} đế dùng chung).
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <div className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs font-bold flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-amber-400" />
                  <span>Quy Tắc: Cắt Cáp Theo Mực Nước Bất Lợi</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Golden Rules */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Box 1: Nguyên tắc căng/chùng */}
            <div className="card card-pad border-l-4 border-l-amber-500 space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>1. NGUYÊN TẮC CỐT TỬ: CĂNG HAY CHÙNG DÂY?</span>
              </div>
              <div className="text-xs text-slate-700 space-y-2.5 leading-relaxed">
                <p className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 font-medium">
                  {F.adjustStep_m > 0
                    ? <><strong>ĐIỀU KIỆN BẮT BUỘC: chỉnh lại mọi dây cho vừa căng mỗi khi mực nước đổi {n(F.adjustStep_m, 0)} m.</strong> Lực dây, cọc, đế trong hồ sơ chỉ đúng với điều kiện này; cắt một lần rồi để nguyên thì lực dây vượt nhiều. </>
                    : <><strong>Mọi dây giữ vừa căng bằng thiết bị bù mực nước + khóa bão.</strong> </>}
                  <strong>Không căng cứng như dây đàn</strong> (lực căng trước T₀ = {n(E.pretension_kN, 0)} kN).
                </p>
                <p>
                  <strong>Lý do cơ học nguy hiểm:</strong>
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                  <li>
                    Nếu căng cứng dây đáy ở mùa bình thường (MNDB): Khi lũ về (MNLKT {n(L.mnlkt)} m), nước dâng thêm {n(L.mnlkt - L.mndb)} m khiến dây thiếu hụt <strong>{n(F.cut.bed.slackNormal.min, 2)} &ndash; {n(F.cut.bed.slackNormal.max, 2)} m</strong> chiều dài &rarr; Sức đẩy nổi hàng trăm tấn của bè sẽ <strong>kéo dìm mép bè hoặc giật nhổ đế neo đáy</strong>!
                  </li>
                  <li>
                    Nếu kéo căng cứng dây bờ ngắn ở mùa bình thường (MNDB): Khi nước rút về mùa cạn (MNC {n(L.mnc)} m), bè hạ thấp sẽ <strong>treo mép bè trên không</strong>, vặn xoắn khung giàn phao.
                  </li>
                </ul>
                <p className="font-semibold text-slate-900 pt-1">
                  &rArr; Giải pháp: <strong>CẮT CÁP THEO MỰC NƯỚC MÀ DÂY DÀI NHẤT</strong>, đánh dấu vạch sơn, rồi <strong>chỉnh dây (xích / tăng đơ ở bích bè) theo mực nước</strong> như điều kiện ở trên.
                </p>
              </div>
            </div>

            {/* Box 2: Quy luật nghịch đảo 2 họ dây */}
            <div className="card card-pad border-l-4 border-l-brand-600 space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Waves className="w-4 h-4 text-brand-600" />
                <span>2. QUY LUẬT NGHỊCH ĐẢO CỦA HAI HỌ DÂY NEO</span>
              </div>
              <div className="text-xs text-slate-700 space-y-2.5 leading-relaxed">
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-blue-900">
                    <Anchor className="w-3.5 h-3.5" />
                    <span>{bedLines} DÂY ĐÁY ({C.bedBases} đế vít xoắn, {C.sharedBases} đế dùng chung):</span>
                  </div>
                  <p>
                    Chốt đế ở cao độ {n(F.cut.bed.pin.min)} &ndash; {n(F.cut.bed.pin.max)} m. Khi nước dâng lên <strong>MNLKT ({n(L.mnlkt)} m)</strong> là lúc bè ở cao nhất &rarr; <strong>DÂY ĐÁY DÀI NHẤT Ở MÙA LŨ MNLKT</strong>.
                  </p>
                  <p className="font-semibold text-blue-900">
                    &rarr; {F.cut.bedGovernedHigh}/{bedLines} dây đáy CẮT THEO MNLKT. Ở MNC ({n(L.mnc)} m) dây đáy chùng tới {n(F.cut.bed.slackLow.max, 2)} m nếu không chỉnh.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{shoreLines} DÂY CỌC BỜ (Cọc khoan nhồi D350):</span>
                  </div>
                  <p>
                    Chốt cọc bờ ở cao độ {n(F.cut.shore.pin.min)} &ndash; {n(F.cut.shore.pin.max)} m. Khi nước hồ rút về <strong>MNC ({n(L.mnc)} m)</strong>, bè tụt xuống thấp khiến khoảng cách chéo từ bờ xuống bè là xa nhất &rarr; <strong>DÂY BỜ DÀI NHẤT Ở MÙA CẠN MNC</strong>.
                  </p>
                  <p className="font-semibold text-emerald-900">
                    &rarr; {F.cut.shoreGovernedLow}/{shoreLines} dây bờ CẮT THEO MNC. Ở MNDB dây bờ chùng {n(F.cut.shore.slackNormal.min, 2)} &ndash; {n(F.cut.shore.slackNormal.max, 2)} m (trung vị {n(F.cut.shore.slackNormal.med, 2)} m) nếu không chỉnh.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Comprehensive Geometry Table */}
          <div className="card card-pad space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h4 className="card-title flex items-center gap-2">
                  <Scale className="w-4 h-4 text-brand-600" />
                  Bảng Thông Số Hình Học &amp; Trạng Thái Dây Toàn Hồ ({C.lines} Tuyến Cáp)
                </h4>
                <p className="card-subtitle">
                  Kết quả tính toán hình học 3D chuẩn xác theo cao độ thực tế (Bích bè +0,35 m, chốt cọc bờ +0,1 m, tai đế neo +0,55 m)
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded bg-slate-100 font-mono text-slate-700 font-bold self-start sm:self-auto">
                {C.lines} Cáp · {F.rafts.length} Bè · {C.anchorPoints} Điểm Neo
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-slate-200 font-mono">
                <thead className="bg-slate-100 text-slate-800 uppercase font-sans">
                  <tr>
                    <th className="p-2.5 border-r border-b border-slate-200">Đặc tính hình học &amp; Trạng thái làm việc</th>
                    <th className="p-2.5 border-r border-b border-slate-200 text-blue-900 font-bold bg-blue-50/60">
                      {bedLines} Tuyến Dây Đáy ({C.bedBases} Đế)
                    </th>
                    <th className="p-2.5 border-b border-slate-200 text-emerald-900 font-bold bg-emerald-50/60">
                      {shoreLines} Tuyến Dây Bờ (Cọc Khoan Nhồi D350)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  <tr>
                    <td className="p-2.5 border-r border-slate-200 font-sans font-semibold">Tầm vươn ngang (mặt bằng)</td>
                    <td className="p-2.5 border-r border-slate-200">{n(F.cut.bed.span.min)} &ndash; {n(F.cut.bed.span.max)} m (trung vị {n(F.cut.bed.span.med)} m)</td>
                    <td className="p-2.5">{n(F.cut.shore.span.min)} &ndash; {n(F.cut.shore.span.max)} m (trung vị {n(F.cut.shore.span.med)} m)</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border-r border-slate-200 font-sans font-semibold">Chiều dài hình học ở MNC ({n(L.mnc)} m)</td>
                    <td className="p-2.5 border-r border-slate-200">Trung vị {n(F.cut.bed.chordLow.med)} m (ngắn nhất)</td>
                    <td className="p-2.5">Trung vị {n(F.cut.shore.chordLow.med)} m &rarr; DÀI NHẤT (chi phối cắt cáp)</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border-r border-slate-200 font-sans font-semibold">Chiều dài hình học ở MNDB ({n(L.mndb)} m)</td>
                    <td className="p-2.5 border-r border-slate-200">Trung vị {n(F.cut.bed.chordNormal.med)} m</td>
                    <td className="p-2.5">Trung vị {n(F.cut.shore.chordNormal.med)} m</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border-r border-slate-200 font-sans font-semibold">Chiều dài hình học ở MNLKT ({n(L.mnlkt)} m)</td>
                    <td className="p-2.5 border-r border-slate-200">Trung vị {n(F.cut.bed.chordHigh.med)} m &rarr; DÀI NHẤT (chi phối cắt cáp)</td>
                    <td className="p-2.5">Trung vị {n(F.cut.shore.chordHigh.med)} m</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border-r border-slate-200 font-sans font-semibold">Độ biến thiên chiều dài (&Delta;L)</td>
                    <td className="p-2.5 border-r border-slate-200">{n(F.cut.bed.change.min, 2)} &ndash; {n(F.cut.bed.change.max, 2)} m</td>
                    <td className="p-2.5">{n(F.cut.shore.change.min, 2)} &ndash; {n(F.cut.shore.change.max, 2)} m (trung vị {n(F.cut.shore.change.med, 2)} m; {F.cut.shortShore} dây ngắn dưới 10 m)</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border-r border-slate-200 font-sans font-semibold">Độ chùng ở MNC ({n(L.mnc)} m), nếu không chỉnh</td>
                    <td className="p-2.5 border-r border-slate-200">{n(F.cut.bed.slackLow.min, 2)} &ndash; {n(F.cut.bed.slackLow.max, 2)} m</td>
                    <td className="p-2.5">CĂNG (dây bờ dài nhất)</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border-r border-slate-200 font-sans font-semibold">Độ chùng ở MNDB ({n(L.mndb)} m), nếu không chỉnh</td>
                    <td className="p-2.5 border-r border-slate-200">{n(F.cut.bed.slackNormal.min, 2)} &ndash; {n(F.cut.bed.slackNormal.max, 2)} m</td>
                    <td className="p-2.5">{n(F.cut.shore.slackNormal.min, 2)} &ndash; {n(F.cut.shore.slackNormal.max, 2)} m</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border-r border-slate-200 font-sans font-semibold">Độ chùng ở MNLKT ({n(L.mnlkt)} m), nếu không chỉnh</td>
                    <td className="p-2.5 border-r border-slate-200">CĂNG (dây đáy dài nhất)</td>
                    <td className="p-2.5">{n(F.cut.shore.slackHigh.min, 2)} &ndash; {n(F.cut.shore.slackHigh.max, 2)} m</td>
                  </tr>
                  <tr className="bg-slate-50 font-bold">
                    <td className="p-2.5 border-r border-slate-200 font-sans">Mực nước lấy chiều dài CẮT CÁP</td>
                    <td className="p-2.5 border-r border-slate-200 text-blue-900">MNLKT {n(L.mnlkt)} m ({F.cut.bedGovernedHigh}/{bedLines} dây) + đoạn phụ kiện</td>
                    <td className="p-2.5 text-emerald-900">MNC {n(L.mnc)} m ({F.cut.shoreGovernedLow}/{shoreLines} dây) + đoạn phụ kiện</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-950 space-y-1">
              <div className="font-bold flex items-center gap-2 text-sky-900">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
                <span>Độ trôi của bè được kiểm tra (C12)</span>
              </div>
              <p className="leading-relaxed">
                Mô hình cân bằng tính độ trôi ngang của từng bè ở mọi mực nước và hướng gió; điều kiện C12: trôi ≤ khe hở nhỏ nhất tới bè / bờ bên cạnh chia 2. Ví dụ {E.raft}: C12 = {util('C12')} ({note('C12')}) Kết quả chỉ đúng khi dây được chỉnh theo mực nước như điều kiện bắt buộc ở trên.
              </p>
            </div>
          </div>

          {/* Section 3: 4-Step Installation Method */}
          <div className="card card-pad space-y-4">
            <h4 className="card-title flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              Quy Trình 4 Bước Thi Công Căng Cáp Ngoài Lòng Hồ
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Step 1 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-sm">
                      1
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Khảo Sát &amp; Cắt Cáp</span>
                  </div>
                  <h5 className="font-bold text-slate-900 text-xs">Cắt Cáp &amp; Đánh Dấu Vạch Sơn</h5>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Đo sâu thực địa cao độ đáy từng đế. Cắt cáp theo chiều dài thiết kế chốt-tới-chốt (L_bất_lợi) cộng thêm đoạn phụ kiện đầu dây do nhà cung cấp cáp quy định (ước tính sơ bộ ~ 1,0 &ndash; 1,5 m). Dùng sơn phản quang đánh dấu mốc khóa vị trí liên kết.
                  </p>
                </div>
                <div className="text-[10px] font-mono text-blue-700 bg-blue-100/60 p-1.5 rounded">
                  L_cắt = L_chốt + L_phụ_kiện
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-sm">
                      2
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Đế Neo Đáy</span>
                  </div>
                  <h5 className="font-bold text-slate-900 text-xs">Hạ Đặt Đế &amp; Gắn Phao Treo</h5>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Hạ đặt đế BTCT vít xoắn xuống đáy hồ. Nối ma-nê tai neo đôi. <strong>Buộc 1 quả phao nổi nhỏ (15 &ndash; 20 kg) cách đế 3 m</strong> để nhấc nhẹ bụng cáp, chống vùi lấp bùn đáy và chống chéo dây khi nước cạn.
                  </p>
                </div>
                <div className="text-[10px] font-mono text-indigo-700 bg-indigo-100/60 p-1.5 rounded">
                  Phao nổi 15-20 kg / dây đáy
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-sm">
                      3
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Cọc Neo Bờ</span>
                  </div>
                  <h5 className="font-bold text-slate-900 text-xs">Kéo Cáp Bờ &amp; Lắp Tăng Đơ</h5>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Dùng tời/pa-lăng xích kéo cáp bờ vừa căng tới tay (không căng cứng). Tại đầu cọc D350 lắp cụm <strong>tăng đơ 2 đầu ma-nê (WLL 10 &ndash; 12 tấn, hành trình &plusmn;300 mm)</strong> để tinh chỉnh theo mùa.
                  </p>
                </div>
                <div className="text-[10px] font-mono text-emerald-700 bg-emerald-100/60 p-1.5 rounded">
                  Tăng đơ WLL 10-12T (&plusmn;300mm)
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-lg bg-amber-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-sm">
                      4
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Liên Kết Bè</span>
                  </div>
                  <h5 className="font-bold text-slate-900 text-xs">Đoạn Xích Vi Chỉnh Bích Bè</h5>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Tại bích mép bè, không buộc cố định cáp mà gắn qua <strong>1 đoạn xích neo ngắn (1 &ndash; 1,5 m)</strong> kèm ma-nê. Đội vận hành dễ dàng tăng/giảm từng mắt xích khi nghiệm thu vị trí bè nổi.
                  </p>
                </div>
                <div className="text-[10px] font-mono text-amber-700 bg-amber-100/60 p-1.5 rounded">
                  Xích vi chỉnh L = 1,0 - 1,5 m
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: 4 Critical On-Site Warnings */}
          <div className="card card-pad border-l-4 border-l-rose-500 space-y-4">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>4 ĐIỂM CẢNH BÁO KỸ THUẬT QUAN TRỌNG CẦN CHỈ ĐẠO HIỆN TRƯỜNG</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
              {/* Warning 1 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">1</span>
                  <span>Đo cao độ đáy thực tại {C.bedBases} vị trí đế trước khi cắt cáp đáy</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Cao độ đế lấy theo đáy thiết kế / địa hình IFC (chốt đế {n(F.cut.bed.pin.min)} &ndash; {n(F.cut.bed.pin.max)} m), chưa phải số đo. Dây đáy rất nhạy với cao độ đáy: <strong>đo cao độ tại tim từng đế trước khi cắt cáp đáy.</strong>
                </p>
              </div>

              {/* Warning 2 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">2</span>
                  <span>{F.cut.shortShore} tuyến dây bờ ngắn dưới 10 m{F.cut.shortShoreRafts.length ? ` (${F.cut.shortShoreRafts.join(', ')})` : ''}</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Dây bờ ngắn đổi góc nhiều khi mực nước thay đổi nên chùng nhiều ở MNDB (dây bờ chùng tới {n(F.cut.shore.slackNormal.max, 2)} m) và hút lực khi căng. Cọc bờ mới đã đặt cách bích ≥ 6 m; các dây ngắn này <strong>phải được chỉnh theo mực nước</strong> và được gắn cờ trong bảng cắt cáp.
                </p>
              </div>

              {/* Warning 3 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">3</span>
                  <span>Kiểm tra sức nổi dự trữ mép bè ở mùa lũ MNLKT</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Ở MNLKT dây đáy dốc {n(F.cut.bed.slopeHigh.min, 0)}&deg; &ndash; {n(F.cut.bed.slopeHigh.max, 0)}&deg;. Thành phần đứng của lực dây kéo mép bè xuống; cần kiểm tra phao mép bè tại bích neo có đủ sức nổi dự trữ (nhà sản xuất bè xác nhận).
                </p>
              </div>

              {/* Warning 4 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">4</span>
                  <span>Tra cứu Bảng Thống Kê Cắt Cáp (Cutting Schedule)</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Chiều dài cắt, mực nước chi phối và độ chùng của từng dây ở sheet <strong>ChieuDaiCatCap</strong> của Bảng Neo Excel (nút "Bảng Neo" hoặc tài liệu đính kèm). Chiều dài là chốt tới chốt, chưa gồm phụ kiện đầu dây.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: TROUBLESHOOTING & REMEDIATION MATRIX                               */}
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
                      BP-1 / BP-2
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
                  <strong>Nguyên nhân:</strong> Lực dây lớn hơn sức chịu ngang của đất theo Broms (BP-1) hoặc γ·M_max &gt; M_rd của tiết diện cọc (BP-2).<br />
                  <strong>Giải pháp khắc phục:</strong>
                </p>
                <ul className="list-disc pl-5 text-xs text-rose-900 space-y-1">
                  <li>BP-2: tăng thép chủ lồng cọc (số thanh, đường kính, mác CB500-V), hàm lượng thép ≤ 4 % tiết diện; nếu vẫn không đủ thì dùng cọc đôi + đài.</li>
                  <li>BP-1: tăng chiều sâu cọc L hoặc dùng cọc đôi.</li>
                  <li>Giữ tim chốt cáp sát mặt đất (≤ 100 mm) — tay đòn lớn hơn làm mômen tăng nhanh.</li>
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
                  <li>Thêm dây ở cạnh bè chịu lực lớn, hoặc lùi cọc bờ xa bích hơn — dây quá ngắn hút lực trong mô hình cân bằng.</li>
                  <li>Kiểm tra cách chỉnh dây theo mực nước (Mục 4): cắt cố định không chỉnh làm lực dây tăng nhiều.</li>
                </ul>
              </div>

              {/* Item C5 */}
              <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-sky-600 text-white font-mono font-bold text-xs">
                      SV-1 … SV-6
                    </span>
                    <span className="font-bold text-sky-950 text-sm">
                      Đế neo vít xoắn KHÔNG ĐẠT (nhổ, trượt, lật, vít, nền)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectSection('input')}
                    className="text-xs font-bold text-sky-700 hover:text-sky-900 underline"
                  >
                    Chỉnh Đế Neo &rarr;
                  </button>
                </div>
                <p className="text-xs text-sky-900 leading-relaxed">
                  <strong>Nguyên nhân:</strong> Dây đáy quá dốc (đế quá gần bè) làm thành phần nhổ T_v lớn, hoặc lực ngang vượt bám dính bùn + gờ + vít.<br />
                  <strong>Giải pháp khắc phục:</strong>
                </p>
                <ul className="list-disc pl-5 text-xs text-sky-900 space-y-1">
                  <li>Để chế độ tự định cỡ đế (Mục 9): cạnh B tăng từng 0,25 m tới 8 m, rồi tăng chiều dày, lấy đế ít bê tông nhất.</li>
                  <li>Dời đế xa bè để dây thoải hơn (sin &theta; nhỏ lại).</li>
                  <li>Khảo sát c_u bùn đáy (cắt cánh / xuyên tĩnh): giá trị 20 kPa đang dùng là giả định, bùn mặt hồ thường chỉ 2–10 kPa.</li>
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
