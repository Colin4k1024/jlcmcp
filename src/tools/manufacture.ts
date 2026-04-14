import { z } from 'zod';
import { BridgeClient } from '../bridge-client.js';

export function registerManufactureTools(server: any, bridge: BridgeClient) {
  server.tool('pcb_export_gerber', '导出 Gerber 制造文件', {}, async () => {
    const data = await bridge.command('pcb_export_gerber');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_export_bom', '导出 PCB BOM（物料清单）', {}, async () => {
    const data = await bridge.command('pcb_export_bom');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_export_pick_place', '导出贴片坐标文件（Pick and Place）', {}, async () => {
    const data = await bridge.command('pcb_export_pick_place');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_export_3d', '导出 3D 模型文件', {}, async () => {
    const data = await bridge.command('pcb_export_3d');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_export_pdf', '导出 PCB PDF 文件', {}, async () => {
    const data = await bridge.command('pcb_export_pdf');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_export_dxf', '导出 DXF 文件（机械交换格式）', {}, async () => {
    const data = await bridge.command('pcb_export_dxf');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_export_dsn', '导出 DSN 文件（Specctra 自动布线格式）', {}, async () => {
    const data = await bridge.command('pcb_export_dsn');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_export_ipc356', '导出 IPC-D-356A 网表文件', {}, async () => {
    const data = await bridge.command('pcb_export_ipc356');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_export_odb', '导出 ODB++ 制造数据包', {}, async () => {
    const data = await bridge.command('pcb_export_odb');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_export_netlist', '导出 PCB 网表文件', {}, async () => {
    const data = await bridge.command('pcb_export_netlist');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('pcb_get_manufacture_data', '获取制造数据概览（可用导出类型及状态）', {}, async () => {
    const data = await bridge.command('pcb_get_manufacture_data');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });
}
