import { ACI, Pt, pair } from './dxfExport';

/**
 * DXF text WITH Vietnamese diacritics (owner's request, 2026-10-06: "bản vẽ
 * toàn chữ không dấu, sửa lại").
 *
 * The file stays pure ASCII: every character outside printable ASCII is
 * written as the DXF Unicode escape \U+XXXX, and every TEXT uses the style
 * "VN", a TrueType font (Arial) — the default txt.shx has no Vietnamese
 * glyphs. Verified by a round trip through AutoCAD 2027 (R12 file in, text
 * read back as real Unicode).
 */
export const VN_TEXT_STYLE = 'VN';

export const escapeDxfUnicode = (s: string): string =>
  [...s].map((ch) => {
    const c = ch.codePointAt(0)!;
    return c >= 0x20 && c <= 0x7e ? ch : `\\U+${c.toString(16).toUpperCase().padStart(4, '0')}`;
  }).join('');

const n = (v: number) => (Number.isFinite(v) ? (Math.round(v * 1000) / 1000).toString() : '0');

export function vnText(layer: string, p: Pt, height: number, value: string): string {
  return (
    pair(0, 'TEXT') + pair(8, layer) +
    pair(10, n(p.x)) + pair(20, n(p.y)) + pair(30, '0.0') +
    pair(40, n(height)) + pair(1, escapeDxfUnicode(value)) + pair(7, VN_TEXT_STYLE)
  );
}

/** A complete R12 document in metres with the layer table and the "VN" text style. */
export function dxfDocumentVn(layers: ReadonlyArray<{ name: string; color: number }>, entities: string): string {
  let tables = pair(0, 'TABLE') + pair(2, 'LAYER') + pair(70, layers.length + 1);
  tables += pair(0, 'LAYER') + pair(2, '0') + pair(70, 0) + pair(62, ACI.white) + pair(6, 'CONTINUOUS');
  for (const l of layers) tables += pair(0, 'LAYER') + pair(2, l.name) + pair(70, 0) + pair(62, l.color) + pair(6, 'CONTINUOUS');
  tables += pair(0, 'ENDTAB');
  tables += pair(0, 'TABLE') + pair(2, 'STYLE') + pair(70, 1) +
    pair(0, 'STYLE') + pair(2, VN_TEXT_STYLE) + pair(70, 0) + pair(40, 0) + pair(41, 1) + pair(50, 0) + pair(71, 0) + pair(42, 1) +
    pair(3, 'arial.ttf') + pair(4, '') + pair(0, 'ENDTAB');
  return (
    pair(0, 'SECTION') + pair(2, 'HEADER') +
    pair(9, '$ACADVER') + pair(1, 'AC1009') +
    pair(9, '$INSUNITS') + pair(70, 6) +
    pair(9, '$MEASUREMENT') + pair(70, 1) +
    pair(0, 'ENDSEC') +
    pair(0, 'SECTION') + pair(2, 'TABLES') + tables + pair(0, 'ENDSEC') +
    pair(0, 'SECTION') + pair(2, 'ENTITIES') + entities + pair(0, 'ENDSEC') +
    pair(0, 'EOF')
  );
}
