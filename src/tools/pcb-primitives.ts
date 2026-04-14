import { z } from 'zod';
import { BridgeClient } from '../bridge-client.js';

export function registerPcbPrimitivesTools(server: any, bridge: BridgeClient): void {
  // ── P2.1: PCB 图元补齐 ─────────────────────────────────────────────────────
  server.tool('pcb_create_arc', '在 PCB 上绘制弧线', {
    layer: z.number().describe('层号 (1=顶层, 2=底层)'),
    net: z.string().optional().default('').describe('网络名称（可为空）'),
    cx: z.number().describe('圆心 X（mil）'),
    cy: z.number().describe('圆心 Y（mil）'),
    radius: z.number().describe('半径（mil）'),
    startAngle: z.number().describe('起始角度（度）'),
    endAngle: z.number().describe('结束角度（度）'),
    width: z.number().optional().default(6).describe('线宽（mil），默认 6'),
  }, async ({ layer, net, cx, cy, radius, startAngle, endAngle, width }: {
    layer: number; net?: string; cx: number; cy: number; radius: number;
    startAngle: number; endAngle: number; width?: number;
  }) => {
    const data = await bridge.command('pcb_create_arc', { layer, net: net || '', cx, cy, radius, startAngle, endAngle, width: width ?? 6 });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_create_polyline', '在 PCB 上绘制折线', {
    layer: z.number().describe('层号'),
    net: z.string().optional().default('').describe('网络名称（可为空）'),
    points: z.array(z.object({ x: z.number(), y: z.number() })).min(2).describe('路径点数组，至少 2 个点'),
    width: z.number().optional().default(6).describe('线宽（mil），默认 6'),
  }, async ({ layer, net, points, width }: {
    layer: number; net?: string; points: Array<{ x: number; y: number }>; width?: number;
  }) => {
    const data = await bridge.command('pcb_create_polyline', { layer, net: net || '', points, width: width ?? 6 });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_create_dimension', '在 PCB 上添加尺寸标注', {
    layer: z.number().describe('层号'),
    x1: z.number().describe('起点 X（mil）'),
    y1: z.number().describe('起点 Y（mil）'),
    x2: z.number().describe('终点 X（mil）'),
    y2: z.number().describe('终点 Y（mil）'),
  }, async ({ layer, x1, y1, x2, y2 }: { layer: number; x1: number; y1: number; x2: number; y2: number }) => {
    const data = await bridge.command('pcb_create_dimension', { layer, x1, y1, x2, y2 });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_create_fill', '在 PCB 上创建填充区域（非铺铜）', {
    layer: z.number().describe('层号'),
    net: z.string().optional().default('').describe('网络名称（可为空）'),
    points: z.array(z.object({ x: z.number(), y: z.number() })).min(3).describe('多边形顶点，至少 3 个'),
  }, async ({ layer, net, points }: { layer: number; net?: string; points: Array<{ x: number; y: number }> }) => {
    const data = await bridge.command('pcb_create_fill', { layer, net: net || '', points });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_create_pad', '在 PCB 上创建独立焊盘', {
    layer: z.number().describe('层号'),
    net: z.string().optional().describe('网络名称'),
    x: z.number().describe('X 坐标（mil）'),
    y: z.number().describe('Y 坐标（mil）'),
    width: z.number().optional().describe('焊盘宽度（mil）'),
    height: z.number().optional().describe('焊盘高度（mil）'),
    shape: z.string().optional().describe('焊盘形状（round/rect/oval）'),
    drill: z.number().optional().describe('钻孔直径（mil），通孔时填写'),
  }, async (params: Record<string, any>) => {
    const data = await bridge.command('pcb_create_pad', params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_modify_pad', '修改焊盘属性', {
    primitiveId: z.string().describe('焊盘图元 ID'),
    net: z.string().optional().describe('新网络名称'),
    width: z.number().optional().describe('新宽度（mil）'),
    height: z.number().optional().describe('新高度（mil）'),
    shape: z.string().optional().describe('新形状'),
  }, async ({ primitiveId, ...rest }: { primitiveId: string; [key: string]: any }) => {
    const data = await bridge.command('pcb_modify_pad', { primitiveId, ...rest });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_get_all_arcs', '获取 PCB 中所有弧线图元', {}, async () => {
    const data = await bridge.command('pcb_get_all_arcs');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_get_adjacent', '获取与指定图元相邻的图元', {
    primitiveId: z.string().describe('图元 ID'),
  }, async ({ primitiveId }: { primitiveId: string }) => {
    const data = await bridge.command('pcb_get_adjacent', { primitiveId });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_get_entire_track', '获取与指定走线段相连的整条走线', {
    primitiveId: z.string().describe('走线段图元 ID'),
  }, async ({ primitiveId }: { primitiveId: string }) => {
    const data = await bridge.command('pcb_get_entire_track', { primitiveId });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_convert_fill_to_pour', '将填充区域转换为铺铜', {
    primitiveId: z.string().describe('填充图元 ID'),
  }, async ({ primitiveId }: { primitiveId: string }) => {
    const data = await bridge.command('pcb_convert_fill_to_pour', { primitiveId });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });
}
