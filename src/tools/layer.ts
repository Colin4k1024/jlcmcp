import { z } from 'zod';
import { BridgeClient } from '../bridge-client.js';

export function registerLayerTools(server: any, bridge: BridgeClient) {
  // pcb_get_layers 已在 state.ts 中注册（bridge action: pcb_get_layers）

  server.tool('pcb_set_layer_count', '设置 PCB 铜层数量', {
    count: z.number().describe('铜层数量（2/4/6/8/...偶数）'),
  }, async ({ count }: { count: number }) => {
    const data = await bridge.command('pcb_set_layer_count', { count });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_add_custom_layer', '添加自定义 PCB 图层', {
    name: z.string().describe('图层名称'),
    layerType: z.string().optional().describe('图层类型（如 signal, plane, mixed），默认 signal'),
  }, async ({ name, layerType }: { name: string; layerType?: string }) => {
    const params: Record<string, unknown> = { name };
    if (layerType) params.layerType = layerType;
    const data = await bridge.command('pcb_add_custom_layer', params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_set_layer_visible', '设置 PCB 图层可见/隐藏', {
    layerId: z.union([z.string(), z.number()]).describe('图层 ID 或编号'),
    visible: z.boolean().describe('true=可见, false=隐藏'),
  }, async ({ layerId, visible }: { layerId: string | number; visible: boolean }) => {
    const data = await bridge.command('pcb_set_layer_visible', { layerId, visible });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_lock_layer', '锁定/解锁 PCB 图层', {
    layerId: z.union([z.string(), z.number()]).describe('图层 ID 或编号'),
    locked: z.boolean().describe('true=锁定, false=解锁'),
  }, async ({ layerId, locked }: { layerId: string | number; locked: boolean }) => {
    const data = await bridge.command('pcb_lock_layer', { layerId, locked });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_set_pcb_type', '设置 PCB 类型（刚性/柔性等）', {
    pcbType: z.string().describe('PCB 类型，如 rigid, flex, rigid-flex'),
  }, async ({ pcbType }: { pcbType: string }) => {
    const data = await bridge.command('pcb_set_pcb_type', { pcbType });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_get_all_nets', '获取 PCB 所有网络名称列表', {}, async () => {
    const data = await bridge.command('pcb_get_all_nets');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });
}
