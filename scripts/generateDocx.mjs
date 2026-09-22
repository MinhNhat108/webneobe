import fs from 'fs';
import path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType
} from 'docx';

const NAVY = '1B365D';
const SLATE_DARK = '1E293B';
const BLUE_HEADER = '2563EB';
const BG_LIGHT_BLUE = 'F1F5F9';
const BG_HEADER_TABLE = 'E2E8F0';
const BORDER_COLOR = 'CBD5E1';

function createTitle(text) {
  return new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 32, // 16pt
        color: NAVY,
        font: 'Times New Roman'
      })
    ]
  });
}

function createSubtitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 300 },
    children: [
      new TextRun({
        text,
        italics: true,
        size: 24, // 12pt
        color: '475569',
        font: 'Times New Roman'
      })
    ]
  });
}

function createH1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 140 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 26, // 13pt
        color: NAVY,
        font: 'Times New Roman'
      })
    ]
  });
}

function createH2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24, // 12pt
        color: BLUE_HEADER,
        font: 'Times New Roman'
      })
    ]
  });
}

function createP(text, isBold = false, isItalic = false) {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 276 },
    alignment: AlignmentType.JUSTIFIED,
    children: [
      new TextRun({
        text,
        bold: isBold,
        italics: isItalic,
        size: 24, // 12pt
        color: SLATE_DARK,
        font: 'Times New Roman'
      })
    ]
  });
}

function createBullet(text, boldPrefix = '') {
  return new Paragraph({
    spacing: { before: 40, after: 40, line: 260 },
    bullet: { level: 0 },
    children: [
      boldPrefix
        ? new TextRun({
            text: boldPrefix + ' ',
            bold: true,
            size: 24,
            color: NAVY,
            font: 'Times New Roman'
          })
        : new TextRun({ text: '' }),
      new TextRun({
        text,
        size: 24,
        color: SLATE_DARK,
        font: 'Times New Roman'
      })
    ]
  });
}

function createFormulaBox(formulaText, explanation) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: BG_LIGHT_BLUE },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: '93C5FD' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: '93C5FD' },
              left: { style: BorderStyle.SINGLE, size: 12, color: BLUE_HEADER },
              right: { style: BorderStyle.SINGLE, size: 4, color: '93C5FD' }
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 60 },
                children: [
                  new TextRun({
                    text: formulaText,
                    bold: true,
                    size: 24,
                    color: '1E3A8A',
                    font: 'Consolas'
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: explanation,
                    italics: true,
                    size: 22,
                    color: '475569',
                    font: 'Times New Roman'
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}

function createCheckTable() {
  const headers = ['Mã', 'Hạng mục kiểm tra', 'Công thức kiểm toán', 'Ngưỡng cho phép', 'Ý nghĩa kỹ thuật'];
  const rowsData = [
    ['C1', 'Sức giữ neo mỏ neo (nguyên vẹn)', 'SF = R_total / H_line', '≥ 1.50', 'Áp dụng cho mỏ neo trọng lực/rùa neo chống trượt'],
    ['C2', 'Bền kéo cáp/xích (nguyên vẹn)', 'SF = MBL / T_max', '≥ 3.00', 'Cáp không bị đứt dưới tải bão thiết kế (DNV-OS-E301)'],
    ['C3', 'Không nhổ neo (dây nằm đáy)', 'L_ground ≥ L_ground,min', '≥ 0 m', 'Tránh lực nhổ đứng cho neo trọng lực (với cọc, chịu nhổ bằng ma sát)'],
    ['C4', 'Tỷ lệ Scope Ratio', 'L_dây / d_nước', '≥ 3.0 ÷ 5.0', 'Đảm bảo độ chùng tạo đường cong xích Catenary giảm giật'],
    ['C5', 'Sức giữ neo (khi đứt 1 dây)', 'SF = R_total / H_line,dam', '≥ 1.05', 'Kiểm tra điều kiện sự cố đứt dây kế cận (Damaged condition)'],
    ['C6', 'Bền kéo cáp (khi đứt 1 dây)', 'SF = MBL / T_max,dam', '≥ 2.00', 'Không đứt dây chuyền khi 1 dây neo xung quanh bị đứt'],
    ['C7', 'Độ thiếu chiều dài dây neo', 'X_deficit ≤ MaxOffset', 'Cảnh báo', 'Dây đủ chiều dài dự trữ khi mực nước hồ dâng/hạ'],
    ['C8', 'Khoảng hở an toàn đáy bè', 'Clearance = h_nước − mớn_nước', '≥ 1.00 m', 'Đảm bảo đáy bè không chạm đáy bùn khi hồ ở mực nước chết (MNC)'],
    ['C9', 'Khoảng cách dây neo quanh bè', 'P_bè / N_dây', '≤ 15.0 m', 'Mật độ dây neo phân bố đều, tránh ứng suất cục bộ xé phao bè'],
    ['C10', 'Sức chịu tải cọc bờ (P_max)', 'P_req = T_max ≤ P_max', '≤ P_max', 'Cọc bờ đủ khả năng chịu lực kéo của cáp theo Broms'],
    ['C11', 'Sức chịu tải cọc lòng hồ (P_max)', 'P_req = T_max ≤ P_max', '≤ P_max', 'Cọc lòng hồ đủ khả năng chịu lực kéo xiên của cáp'],
    ['BP-1', 'Sức chịu tải ngang cọc bờ', 'H_applied / H_allow', '≤ 1.00', 'Đất bờ không bị phá hoại trượt ngang (FS = 2.5 theo Broms)'],
    ['BP-2', 'Ứng suất uốn cọc bờ', 'M_max / M_rd', '≤ 1.00', 'Bê tông cốt thép thân cọc bờ không bị nứt gãy do uốn'],
    ['BP-3', 'Sức chịu tải ngang cọc đáy hồ', 'T_h / H_allow', '≤ 1.00', 'Bùn sét đáy hồ không bị phá hoại ép trồi ngang'],
    ['BP-4', 'Sức chịu nhổ cọc đáy hồ', 'T_v / Q_nhổ,all', '≤ 1.00', 'Cọc không bị lực kéo đứng của cáp nhổ bật lên (ma sát thân)'],
    ['BP-5', 'Ứng suất uốn cọc đáy hồ', 'M_max / M_rd', '≤ 1.00', 'Bê tông cốt thép thân cọc lòng hồ không bị nứt gãy do uốn']
  ];

  const colWidths = [10, 25, 25, 15, 25]; // percentages

  const headerRow = new TableRow({
    children: headers.map((h, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: BG_HEADER_TABLE },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR },
        left: { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR },
        right: { style: BorderStyle.SINGLE, size: 6, color: BORDER_COLOR }
      },
      children: [
        new Paragraph({
          alignment: i === 0 || i === 3 ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [
            new TextRun({
              text: h,
              bold: true,
              size: 22,
              color: NAVY,
              font: 'Times New Roman'
            })
          ]
        })
      ]
    }))
  });

  const dataRows = rowsData.map((row) => new TableRow({
    children: row.map((cell, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.PERCENTAGE },
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
        left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
        right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR }
      },
      children: [
        new Paragraph({
          alignment: i === 0 || i === 3 ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [
            new TextRun({
              text: cell,
              bold: i === 0,
              size: 20,
              color: SLATE_DARK,
              font: i === 0 || i === 2 ? 'Consolas' : 'Times New Roman'
            })
          ]
        })
      ]
    }))
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows]
  });
}

async function buildDocument() {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: 24, color: SLATE_DARK }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } // 1 inch = 1440 twips
          }
        },
        children: [
          createTitle('DỰ ÁN ĐIỆN MẶT TRỜI NỔI HỒ HUỔI VANH'),
          createSubtitle('THUYẾT MINH PHƯƠNG PHÁP TÍNH TOÁN & KIỂM TRA ĐÁNH GIÁ AN TOÀN HỆ THỐNG NEO BÈ'),

          createH1('I. TỔNG QUAN HỆ THỐNG VÀ CĂN CỨ PHÁP LÝ TIÊU CHUẨN'),
          createP(
            'Hệ thống tính toán neo bè điện mặt trời nổi (FPV) hồ Huổi Vanh được xây dựng dựa trên các tiêu chuẩn kỹ thuật chuyên ngành hàng hải, công trình thủy và móng cọc công trình:'
          ),
          createBullet('Tiêu chuẩn thiết kế hệ thống điện mặt trời nổi.', 'DNV-ST-0119 (2021):'),
          createBullet('Tiêu chuẩn vị trí và định vị hệ thống neo ngoài khơi và hồ chứa.', 'DNV-OS-E301 (2021):'),
          createBullet('Tiêu chuẩn quốc gia về thiết kế móng cọc (áp dụng tính toán cọc neo Broms).', 'TCVN 10304:2014:'),
          createBullet('Tiêu chuẩn thiết kế tải trọng và tác động (áp lực gió bão).', 'TCVN 2737:2023:'),
          createBullet('Khuyến nghị thực hành thiết kế hệ thống neo giữ trạm nổi.', 'API RP 2SK:'),
          createP(
            'Chu trình tính toán trên website được thiết kế khép kín và tự động: từ việc tính toán tải trọng khí tượng thủy văn, phân rã sức căng cáp, đến kiểm toán sức chịu tải của cọc bê tông cốt thép ngàm trong nền đất theo phương pháp Broms.'
          ),

          createH1('II. THUYẾT MINH CHI TIẾT TAB KẾT QUẢ (BẢNG TÍNH TRUNG GIAN)'),
          createP(
            'Tab Kết quả trung gian trình bày tường minh các bước tính toán trung gian theo 5 khối nội dung chính:'
          ),

          createH2('1. Khối tải trọng môi trường tác dụng lên hệ bè (F_env)'),
          createP(
            'Tải trọng môi trường bao gồm tác động của gió bão, dòng chảy nước mặt hồ và sóng trôi dạt (wave drift):'
          ),
          createFormulaBox(
            'q = 0.5 * ρ_air * V_wind^2  (Pa)',
            'Trong đó: ρ_air = 1.25 kg/m³ là mật độ không khí; V_wind là vận tốc gió thiết kế (bão) tại cao độ chuẩn.'
          ),
          createP(
            '• Lực gió tác dụng lên mảng pin nổi (F_pin): Các dãy pin đặt nghiêng góc α = 12° đón gió. Diện tích cản gió hiệu dụng tính theo hình chiếu đón gió có xét đến hệ số chắn gió tương hỗ giữa các dãy pin liên tiếp:'
          ),
          createFormulaBox(
            'F_pin = q * Cd_pin * A_proj * η_shield  (N)\nA_proj = N_tấm * A_1tấm * sin(12°)',
            'Trong đó: Cd_pin = 1.3 là hệ số khí động học; η_shield = 0.55 là hệ số che chắn tương hỗ (shielding factor) theo DNV-ST-0119.'
          ),
          createP(
            '• Lực gió tác dụng lên thành phao nổi (F_phao): Tính trên chiều cao mạn khô tự do h_mạn = 0.35m:'
          ),
          createFormulaBox(
            'F_phao = q * Cd_float * (B_bè * h_mạn)  (N)',
            'Trong đó: Cd_float = 1.1 là hệ số cản của phao; B_bè là chiều rộng đón gió.'
          ),
          createP(
            '• Lực dòng chảy (F_current) & Lực sóng trôi dạt (F_wave): Tính toán tác động của dòng chảy lòng hồ lên phần ngập nước (mớn nước d = 0.15m) và lực đẩy trôi do sóng phản xạ:'
          ),
          createFormulaBox(
            'F_current = 0.5 * ρ_w * Cd_c * A_ngập * V_c^2\nF_wave = 0.5 * ρ_w * g * (Hs/2)^2 * B_bè * Cd_w',
            'Trong đó: Hs là chiều cao sóng có nghĩa; ρ_w = 1000 kg/m³; Cd_c = 1.2; Cd_w = 1.0.'
          ),
          createP(
            '• Tổng lực môi trường tổ hợp (F_env): Với vùng hồ khép kín, gió chiếm trên 95% tổng lực. Phần mềm áp dụng chế độ tổ hợp gộp chuẩn FPV với hệ số phụ trội sóng/dòng chảy 1.05:'
          ),
          createFormulaBox(
            'F_env = (F_pin + F_phao) * 1.05 * k_tổ_hợp  (kN)',
            'Giá trị F_env này được dùng làm đầu vào để phân bổ cho toàn bộ các hướng neo.'
          ),

          createH2('2. Phân bố lực căng dây neo (T_max) và sức đứt cáp (MBL)'),
          createP(
            'Lực kéo lớn nhất xuất hiện trên sợi cáp bất lợi nhất (thường nằm ở các góc bè đón gió) được xác định bằng cách lấy giá trị cực trị lớn hơn giữa 2 phương pháp:'
          ),
          createBullet(
            'T_focus = F_env * k_focus + T_0 (với k_focus ≈ 0.25 ÷ 0.30 là tỷ lệ tải trọng tập trung tại dây góc; T_0 là lực căng trước ban đầu).',
            'Phương pháp hệ số tập trung tải (Focus Factor):'
          ),
          createBullet(
            'T_geom = F_env / (N_eff * cos(θ)) + T_0 (với N_eff là số lượng dây neo cùng hướng làm việc; θ là góc nghiêng cáp).',
            'Phương pháp phân bố hình học (Geometric):'
          ),
          createP(
            'Từ lực căng T_max, phân rã thành 2 thành phần tác dụng lên đầu cọc neo:'
          ),
          createFormulaBox(
            'H = T_max * cos(θ)  [Lực kéo ngang]\nV = T_max * sin(θ)  [Lực nhổ đứng]',
            'Yêu cầu bền đứt của cáp: MBL_yêu_cầu = T_max * SF_dây (với SF_dây = 3.0 theo tiêu chuẩn DNV-OS-E301).'
          ),

          createH2('3. Hình học & Chiều dài cáp 4 cạnh cụm bè'),
          createP(
            'Dựa trên tọa độ khảo sát thực tế và mặt cắt địa hình lòng hồ Huổi Vanh:'
          ),
          createBullet(
            'Được tính từ mép bè vượt mặt nước và dốc ta-luy mép bờ hồ: L_bờ = √[(Khoảng_cách + Δh_nước * m_dốc)² + Δz²].',
            'Cạnh Nam, Bắc, Đông (Cọc bờ):'
          ),
          createBullet(
            'Cáp xiên từ mép bè xuống cọc chôn dưới đáy: L_đáy = √[X_khoảng_cách² + H_nước²], góc nghiêng θ = arctan(H_nước / X_đáy).',
            'Cạnh Tây (Cọc đáy hồ):'
          ),
          createP(
            'Phần mềm tổng hợp số lượng sợi của từng cạnh để đưa ra Tổng mét cáp thực tế cần đặt hàng phục vụ dự toán thi công.'
          ),

          createH2('4. Khả năng chịu lực của Cọc neo theo phương pháp Broms (1964)'),
          createP(
            'Cọc neo hồ Huổi Vanh là cọc bê tông cốt thép ngàm tự do trong tầng đất sét/bùn dẻo mềm lòng hồ (tham số lực dính không thoát nước cu):'
          ),
          createBullet(
            'Bỏ qua lớp đất mặt yếu sâu 1.5D; chiều sâu ngàm hiệu dụng g = L - 1.5D. Cường độ kháng đất cực hạn p = 9 * cu * D (kN/m).',
            'Sức kháng đất cực hạn (p):'
          ),
          createBullet(
            'Giải phương trình bậc 2 cân bằng mô men Broms: 0.5/p * Hu² + (e + 1.5D + g)*Hu - 0.5*p*g² = 0. Sức chịu ngang cho phép: H_allow = Hu / 2.5 (với hệ số an toàn FS = 2.5 theo TCVN 10304:2014).',
            'Sức chịu tải ngang cho phép (H_allow):'
          ),
          createBullet(
            'M_max = H * [e + 1.5D + 0.5 * (H / p)]. Kiểm tra điều kiện bền: M_max ≤ M_rd (mô men kháng uốn của bê tông Mác 300 + cốt thép chủ CB300/CB400).',
            'Mô-men uốn lớn nhất trong cọc (M_max):'
          ),
          createBullet(
            'Q_nhổ,all = [α * cu * (π * D * L)] / 2.0 (với hệ số dính bám α = 0.7, hệ số an toàn chống nhổ FS = 2.0).',
            'Sức chịu nhổ do ma sát thân cọc đáy hồ (Q_nhổ):'
          ),

          createH2('5. Thuật toán tối ưu chiều sâu cọc (L_opt) và Sức chịu tải P_max'),
          createP(
            'Phần mềm quét tăng dần chiều sâu ngàm L từ 2.0m đến 20.0m với bước thi công 0.25m để xác định L_opt là chiều sâu ngàm nhỏ nhất thỏa mãn đồng thời cả 3 điều kiện:'
          ),
          createBullet('H_allow(L) ≥ H_kéo (Khả năng chịu lực ngang của đất nền)', 'Điều kiện 1:'),
          createBullet('Q_nhổ,all(L) ≥ V_nhổ (Khả năng chống nhổ do ma sát thân cọc lòng hồ)', 'Điều kiện 2:'),
          createBullet('M_max ≤ M_rd (Khả năng chịu uốn của tiết diện bê tông cốt thép cọc)', 'Điều kiện 3:'),
          createP(
            'Sức chịu tải cho phép P_max (kN) là lực căng cáp lớn nhất mà cọc tiếp nhận được, được quy đổi từ giá trị nhỏ nhất của 3 khả năng chịu lực trên:'
          ),
          createFormulaBox(
            'P_max = min [ H_allow / cos(θ) ,  H_Mrd / cos(θ) ,  Q_nhổ / sin(θ) ]',
            'Cọc được đánh giá ĐẠT khi lực kéo cáp thiết kế P_req ≤ P_max.'
          ),

          createH1('III. THUYẾT MINH CHI TIẾT TAB KIỂM TRA (ĐÁNH GIÁ AN TOÀN)'),
          createP(
            'Tab Kiểm tra tổng hợp toàn bộ các kết quả tính toán thành ma trận đánh giá an toàn, gồm 11 tiêu chuẩn tổng thể (C1 ÷ C11) và 5 tiêu chuẩn móng cọc Broms (BP-1 ÷ BP-5):'
          ),
          createCheckTable(),
          createP(' '),
          createH2('Quy tắc ra kết luận chung (Overall Verdict):'),
          createBullet(
            'Khi 100% các tiêu chí bắt buộc (Mandatory) đều thỏa mãn, tức là Hệ số sử dụng Utilization = Giá_trị_tính / Ngưỡng ≤ 1.0 (Dư an toàn Margin ≥ 0%).',
            'ĐẠT (PASS):'
          ),
          createBullet(
            'Khi có bất kỳ 1 tiêu chí bắt buộc nào vượt ngưỡng (Utilization > 1.0). Hệ thống sẽ bôi đỏ toàn bộ dòng đó và hiển thị đích danh tiêu chí khống chế nguy hiểm nhất trên đầu bảng để kỹ sư kịp thời tăng kích thước cọc, tăng mác thép hoặc bổ sung dây neo.',
            'KHÔNG ĐẠT (FAIL):'
          ),
          createBullet(
            'Áp dụng cho các tiêu chí không thuộc cấu hình hiện tại (ví dụ: neo cọc thì không áp dụng tiêu chí C1/C5 của mỏ neo trọng lực đáy bùn).',
            'KHÔNG ÁP DỤNG (SKIP):'
          ),

          createH1('IV. KẾT LUẬN VÀ KIẾN NGHỊ THI CÔNG'),
          createP(
            '1. Hệ thống tính toán trên web đã phản ánh đầy đủ và chính xác các hiện tượng vật lý, cơ học dây neo và địa kỹ thuật móng cọc của dự án Hồ Huổi Vanh theo đúng 12 cụm bè và 299 vị trí khảo sát thực địa.'
          ),
          createP(
            '2. Kết quả tính toán là căn cứ thiết kế kỹ thuật. Khi triển khai thi công thực tế tại hiện trường, nhà thầu cần tiến hành thí nghiệm thử tải tĩnh kéo/nhổ cọc (tối thiểu 1% tổng số cọc theo TCVN 9393:2012) để hiệu chuẩn lại các chỉ tiêu lực dính cu và ma sát thành bên thực tế của lòng hồ Huổi Vanh.'
          )
        ]
      }
    ]
  });

  return doc;
}

async function run() {
  const doc = await buildDocument();
  const buffer = await Packer.toBuffer(doc);

  const targetDir1 = path.resolve('E:/Out Job/Chu Giap/Web tính neo bè/Tài liệu hồ Huổi Vanh');
  const targetDir2 = path.resolve('public/docs_huoi_vanh');

  const fileName = 'THUYET_MINH_TINH_TOAN_KET_QUA_VA_KIEM_TRA_NEO_BE.docx';

  if (!fs.existsSync(targetDir1)) {
    fs.mkdirSync(targetDir1, { recursive: true });
  }
  const file1 = path.join(targetDir1, fileName);
  fs.writeFileSync(file1, buffer);
  console.log('Successfully saved to:', file1);

  if (fs.existsSync(targetDir2)) {
    const file2 = path.join(targetDir2, fileName);
    fs.writeFileSync(file2, buffer);
    console.log('Successfully copied to:', file2);
  }
}

run().catch((err) => {
  console.error('Error generating docx:', err);
  process.exit(1);
});
