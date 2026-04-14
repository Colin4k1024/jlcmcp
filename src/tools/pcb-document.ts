import { z } from 'zod';
import { BridgeClient } from '../bridge-client.js';

export function registerPcbDocumentTools(server: any, bridge: BridgeClient): void {
  // ── P2.4: 文档与坐标工具 ──────────────────────────────────────────────────
  server.tool('pcb_navigate_to', '导航到 PCB 指定坐标（居中显示）', {
    x: z.number().describe('目标 X 坐标（mil）'),
    y: z.number().describe('目标 Y 坐标（mil）'),
    zoom: z.number().optional().describe('缩放级别（可选）'),
  }, async ({ x, y, zoom }: { x: number; y: number; zoom?: number }) => {
    const params: Record<string, unknown> = { x, y };
    if (zoom !== undefined) params.zoom = zoom;
    const data = await bridge.command('pcb_navigate_to', params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_navigate_to_region', '导航到 PCB 指定矩形区域（自适应缩放）', {
    x1: z.number().describe('区域左上角 X（mil）'),
    y1: z.number().describe('区域左上角 Y（mil）'),
    x2: z.number().describe('区域右下角 X（mil）'),
    y2: z.number().describe('区域右下角 Y（mil）'),
  }, async ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => {
    const data = await bridge.command('pcb_navigate_to_region', { x1, y1, x2, y2 });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_zoom_to_outline', '缩放至显示整个 PCB 板框', {}, async () => {
    const data = await bridge.command('pcb_zoom_to_outline');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_canvas_to_data', '将画布坐标转换为 PCB 数据坐标', {
    canvasX: z.number().describe('画布 X 坐标（px）'),
    canvasY: z.number().describe('画布 Y 坐标（px）'),
  }, async ({ canvasX, canvasY }: { canvasX: number; canvasY: number }) => {
    const data = await bridge.command('pcb_canvas_to_data', { canvasX, canvasY });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_get_primitives_in_region', '获取指定矩形区域内的所有图元', {
    x1: z.number().describe('区域左上角 X（mil）'),
    y1: z.number().describe('区域左上角 Y（mil）'),
    x2: z.number().describe('区域右下角 X（mil）'),
    y2: z.number().describe('区域右下角 Y（mil）'),
    layer: z.number().optional().describe('层号（不填则所有层）'),
  }, async ({ x1, y1, x2, y2, layer }: { x1: number; y1: number; x2: number; y2: number; layer?: number }) => {
    const params: Record<string, unknown> = { x1, y1, x2, y2 };
    if (layer !== undefined) params.layer = layer;
    const data = await bridge.command('pcb_get_primitives_in_region', params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });
}
