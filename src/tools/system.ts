import { z } from 'zod';
import { BridgeClient } from '../bridge-client.js';

export function registerSystemTools(server: any, bridge: BridgeClient): void {
  // ── P3.3: 系统实用工具 ────────────────────────────────────────────────────
  server.tool('sys_get_environment', '获取 EDA 环境信息（版本、语言、操作系统等）', {}, async () => {
    const data = await bridge.command('sys_get_environment');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sys_unit_convert', '单位换算（mil ↔ mm ↔ inch）', {
    value: z.number().describe('待换算的数值'),
    from: z.enum(['mil', 'mm', 'inch']).describe('源单位'),
    to: z.enum(['mil', 'mm', 'inch']).describe('目标单位'),
  }, async ({ value, from, to }: { value: number; from: string; to: string }) => {
    const data = await bridge.command('sys_unit_convert', { value, from, to });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sys_show_toast', '在 EDA 编辑器中显示提示消息', {
    message: z.string().describe('提示消息内容'),
    type: z.enum(['info', 'success', 'warning', 'error']).optional().default('info').describe('消息类型，默认 info'),
    duration: z.number().optional().default(3000).describe('显示时长（毫秒），默认 3000'),
  }, async ({ message, type, duration }: { message: string; type?: string; duration?: number }) => {
    const data = await bridge.command('sys_show_toast', { message, type: type ?? 'info', duration: duration ?? 3000 });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sys_file_save', '将内容保存到本地文件系统', {
    filename: z.string().describe('文件名（含扩展名）'),
    content: z.string().describe('文件内容'),
    encoding: z.string().optional().default('utf-8').describe('编码方式，默认 utf-8'),
  }, async ({ filename, content, encoding }: { filename: string; content: string; encoding?: string }) => {
    const data = await bridge.command('sys_file_save', { filename, content, encoding: encoding ?? 'utf-8' });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sys_file_read', '从本地文件系统读取文件', {
    filename: z.string().describe('文件路径或文件名'),
    encoding: z.string().optional().default('utf-8').describe('编码方式，默认 utf-8'),
  }, async ({ filename, encoding }: { filename: string; encoding?: string }) => {
    const data = await bridge.command('sys_file_read', { filename, encoding: encoding ?? 'utf-8' });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('sys_import_project', '通过项目文件路径导入 EDA 工程', {
    filePath: z.string().describe('工程文件路径（.eprj 或 .zip）'),
  }, async ({ filePath }: { filePath: string }) => {
    const data = await bridge.command('sys_import_project', { filePath });
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });
}
