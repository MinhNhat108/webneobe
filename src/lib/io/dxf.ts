import DxfParser from 'dxf-parser';

export interface DxfRenderStats {
  entityCount: number;
  layers: string[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export function parseDxfFile(dxfString: string) {
  const parser = new DxfParser();
  try {
    const parsed = parser.parseSync(dxfString);
    return { success: true, dxf: parsed, error: null };
  } catch (err: any) {
    return { success: false, dxf: null, error: err?.message || 'Không thể phân tích file DXF' };
  }
}

export function renderDxfToCanvas(
  dxfData: any,
  canvas: HTMLCanvasElement,
  scaleFactor: number = 1.0,
  offsetX: number = 0,
  offsetY: number = 0
): DxfRenderStats | null {
  const ctx = canvas.getContext('2d');
  if (!ctx || !dxfData || !dxfData.entities) return null;

  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = '#0f172a'; // slate-900 CAD dark background
  ctx.fillRect(0, 0, width, height);

  // Compute extents
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const entities = dxfData.entities;
  const layers = new Set<string>();

  for (const ent of entities) {
    if (ent.layer) layers.add(ent.layer);
    if (ent.type === 'LINE') {
      for (const p of ent.vertices || []) {
        if (p.x !== undefined) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
      }
    } else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
      for (const p of ent.vertices || []) {
        if (p.x !== undefined) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
      }
    } else if (ent.type === 'CIRCLE' || ent.type === 'ARC') {
      const cx = ent.center?.x || 0;
      const cy = ent.center?.y || 0;
      const r = ent.radius || 1;
      minX = Math.min(minX, cx - r);
      maxX = Math.max(maxX, cx + r);
      minY = Math.min(minY, cy - r);
      maxY = Math.max(maxY, cy + r);
    }
  }

  if (minX === Infinity) {
    minX = -100; maxX = 100; minY = -100; maxY = 100;
  }

  const modelWidth = Math.max(1, maxX - minX);
  const modelHeight = Math.max(1, maxY - minY);

  const margin = 40;
  const fitScale = Math.min((width - 2 * margin) / modelWidth, (height - 2 * margin) / modelHeight);
  const finalScale = fitScale * scaleFactor;

  const modelCenterX = (minX + maxX) / 2.0;
  const modelCenterY = (minY + maxY) / 2.0;

  // CAD coordinate transform: invert Y because CAD Y is upwards, Canvas Y is downwards
  const toScreenX = (x: number) => width / 2.0 + (x - modelCenterX) * finalScale + offsetX;
  const toScreenY = (y: number) => height / 2.0 - (y - modelCenterY) * finalScale + offsetY;

  // Draw Grid lines
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < width; x += 50) {
    ctx.moveTo(x, 0); ctx.lineTo(x, height);
  }
  for (let y = 0; y < height; y += 50) {
    ctx.moveTo(0, y); ctx.lineTo(width, y);
  }
  ctx.stroke();

  // Draw Entities
  ctx.strokeStyle = '#38bdf8'; // sky-400
  ctx.lineWidth = 1.5;

  for (const ent of entities) {
    if (ent.type === 'LINE' && ent.vertices && ent.vertices.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(toScreenX(ent.vertices[0].x), toScreenY(ent.vertices[0].y));
      ctx.lineTo(toScreenX(ent.vertices[1].x), toScreenY(ent.vertices[1].y));
      ctx.stroke();
    } else if ((ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') && ent.vertices && ent.vertices.length > 0) {
      ctx.beginPath();
      ctx.moveTo(toScreenX(ent.vertices[0].x), toScreenY(ent.vertices[0].y));
      for (let i = 1; i < ent.vertices.length; i++) {
        ctx.lineTo(toScreenX(ent.vertices[i].x), toScreenY(ent.vertices[i].y));
      }
      if (ent.shape) {
        ctx.closePath();
      }
      ctx.stroke();
    } else if (ent.type === 'CIRCLE' && ent.center) {
      const sx = toScreenX(ent.center.x);
      const sy = toScreenY(ent.center.y);
      const sr = (ent.radius || 1) * finalScale;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1, sr), 0, 2 * Math.PI);
      ctx.stroke();
    } else if (ent.type === 'ARC' && ent.center) {
      const sx = toScreenX(ent.center.x);
      const sy = toScreenY(ent.center.y);
      const sr = (ent.radius || 1) * finalScale;
      const startAngle = -ent.endAngle || 0;
      const endAngle = -ent.startAngle || 0;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1, sr), startAngle, endAngle);
      ctx.stroke();
    } else if (ent.type === 'TEXT' && ent.startPoint) {
      const sx = toScreenX(ent.startPoint.x);
      const sy = toScreenY(ent.startPoint.y);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.fillText(ent.text || '', sx, sy);
    }
  }

  return {
    entityCount: entities.length,
    layers: Array.from(layers),
    minX, maxX, minY, maxY,
    width: modelWidth,
    height: modelHeight
  };
}
