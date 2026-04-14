import { z } from 'zod';
import { BridgeClient } from '../bridge-client.js';

export function registerEditorTools(server: any, bridge: BridgeClient): void {
  // ── P3.2: 编辑器控制 ──────────────────────────────────────────────────────
  server.tool('editor_zoom_to', '缩放到指定坐标或元件（居中并聚焦）', {
    uuid: z.string().optional().describe('图元 UUID（可选，不填则按坐标）'),
    x: z.number().optional().describe('X 坐标（mil）'),
    y: z.number().optional().describe('Y 坐标（mil）'),
    scale: z.number().optional().describe('缩放倍数（可选）'),
  }, async (params: Record<string, any>) => {
    const data = await bridge.command('editor_zoom_to', params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('editor_zoom_to_selected', '缩放到当前选中图元的边界框', {}, async () => {
    const data = await bridge.command('editor_zoom_to_selected');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('editor_generate_markers', '在指定位置生成可视化标记（用于高亮提示）', {
    markers: z.array(z.object({
      x: z.number().describe('X 坐标（mil）'),
      y: z.number().describe('Y 坐标（mil）'),
      label: z.string().optional().describe('标记标签（可选）'),
      color: z.string().optional().describe('标记颜色（可选，如 #FF0000）'),
    })).describe('标记列表'),
  }, async ({ markers }: { markers: Array<{ x: number; y: number; label?: string; color?: string }> }) => {
    const data = await bridge.command('editor_generate_markers', { markers });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('editor_remove_markers', '移除所有可视化标记', {}, async () => {
    const data = await bridge.command('editor_remove_markers');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('editor_get_screenshot', '获取当前编辑器可见区域的截图（base64）', {
    format: z.string().optional().default('png').describe('图片格式（png/jpeg），默认 png'),
  }, async ({ format }: { format?: string }) => {
    const data = await bridge.command('editor_get_screenshot', { format: format ?? 'png' });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });
}
