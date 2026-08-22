import * as XLSX from 'xlsx';
import importKeysData from '../../data/importKeys.json';
import { ProjectState } from '../calc/types';

export interface ImportKeyDefinition {
  key: string;
  label: string;
  section: string;
  target: string;
  type: string;
  default?: any;
}

export interface ParsedSheetData {
  sheetName: string;
  rawRows: (string | number | null)[][];
  isKeyValue: boolean;
  headers?: string[];
  records?: Record<string, any>[];
  parsedParams?: Record<string, any>;
}

export function parseSpreadsheet(fileData: ArrayBuffer | Uint8Array): ParsedSheetData[] {
  try {
    const wb = XLSX.read(fileData, { type: 'array' });
    const results: ParsedSheetData[] = [];

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as (string | number | null)[][];
      if (!rawRows || rawRows.length === 0) continue;

      // Check if Key-Value
      let isKeyValue = false;
      const parsedParams: Record<string, any> = {};

      const keyDefs = importKeysData as ImportKeyDefinition[];
      const knownKeys = new Set(keyDefs.map(k => k.key.toUpperCase()));

      let matchCount = 0;
      for (const row of rawRows) {
        if (row && row[0] && typeof row[0] === 'string') {
          const col0 = row[0].trim().toUpperCase();
          if (knownKeys.has(col0) || keyDefs.some(k => col0.includes(k.label.toUpperCase()))) {
            matchCount++;
            const matchingDef = keyDefs.find(k => k.key === col0 || col0.includes(k.label.toUpperCase()));
            if (matchingDef && row[1] !== undefined && row[1] !== null) {
              const val = matchingDef.type === 'number' ? parseFloat(String(row[1]).replace(/,/g, '')) : String(row[1]);
              parsedParams[matchingDef.target] = val;
            }
          }
        }
      }

      if (matchCount >= 3) {
        isKeyValue = true;
      }

      // Tabular detection
      let headers: string[] = [];
      const records: Record<string, any>[] = [];
      if (!isKeyValue) {
        // Find first row with at least 2 non-empty strings
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(10, rawRows.length); i++) {
          const r = rawRows[i];
          if (r && r.filter(c => c !== null && c !== undefined && String(c).trim().length > 0).length >= 2) {
            headerRowIndex = i;
            break;
          }
        }
        headers = (rawRows[headerRowIndex] || []).map(c => String(c || '').trim());
        for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
          const r = rawRows[i];
          if (!r || r.length === 0) continue;
          const rowObj: Record<string, any> = {};
          headers.forEach((h, colIdx) => {
            if (h) rowObj[h] = r[colIdx];
          });
          records.push(rowObj);
        }
      }

      results.push({
        sheetName,
        rawRows,
        isKeyValue,
        headers,
        records,
        parsedParams: isKeyValue ? parsedParams : undefined
      });
    }

    return results;
  } catch (err: any) {
    throw new Error(`Không thể đọc file Excel/CSV: ${err?.message || 'File không đúng định dạng'}`);
  }
}

export function generateTemplateWorkbook(): void {
  const wb = XLSX.utils.book_new();
  const keyDefs = importKeysData as ImportKeyDefinition[];

  const rows = [
    ['MÃ THÔNG SỐ (KEY)', 'GIÁ TRỊ (VALUE)', 'TÊN THÔNG SỐ', 'ĐƠN VỊ / HƯỚNG DẪN']
  ];

  for (const k of keyDefs) {
    rows.push([
      k.key,
      k.default !== undefined ? k.default : '',
      k.label,
      k.type === 'number' ? 'Số (vd: 30)' : 'Chữ (vd: Tên dự án)'
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 35 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws, 'MauNhapThongSo');

  XLSX.writeFile(wb, 'mau_nhap_thong_so_neo_be.xlsx');
}

export function applyParamsToProjectState(
  currentState: ProjectState,
  params: Record<string, any>
): ProjectState {
  const next: ProjectState = JSON.parse(JSON.stringify(currentState));

  for (const [path, val] of Object.entries(params)) {
    if (val === undefined || val === null || (typeof val === 'number' && isNaN(val))) continue;
    const parts = path.split('.');
    if (parts.length === 2) {
      const [section, field] = parts;
      if ((next as any)[section]) {
        (next as any)[section][field] = val;
      }
    }
  }

  return next;
}
