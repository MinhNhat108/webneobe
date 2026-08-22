import React from 'react';

interface PreviewGridProps {
  data: (string | number | null)[][];
  onCellChange: (rowIdx: number, colIdx: number, val: string) => void;
}

export const PreviewGrid: React.FC<PreviewGridProps> = ({ data, onCellChange }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-xs text-slate-400">
        Không có dữ liệu trong bảng tính này
      </div>
    );
  }

  return (
    <div className="w-full max-h-80 overflow-auto border border-slate-200 rounded-lg">
      <table className="w-full text-xs text-left border-collapse font-mono">
        <thead className="bg-slate-100 text-slate-700 uppercase font-semibold sticky top-0 border-b border-slate-200">
          <tr>
            <th className="px-2 py-1.5 border-r border-slate-200 w-10 text-center bg-slate-200">#</th>
            {data[0]?.map((_, colIdx) => (
              <th key={colIdx} className="px-3 py-1.5 border-r border-slate-200">
                {String.fromCharCode(65 + (colIdx % 26))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-sky-50/50">
              <td className="px-2 py-1 border-r border-slate-200 text-center text-slate-400 bg-slate-50 select-none">
                {rowIdx + 1}
              </td>
              {row.map((cell, colIdx) => (
                <td key={colIdx} className="px-2 py-1 border-r border-slate-200">
                  <input
                    type="text"
                    value={cell !== null && cell !== undefined ? String(cell) : ''}
                    onChange={(e) => onCellChange(rowIdx, colIdx, e.target.value)}
                    className="w-full bg-transparent border-none outline-none focus:bg-white focus:ring-1 focus:ring-brand-500 rounded px-1 text-slate-900"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
