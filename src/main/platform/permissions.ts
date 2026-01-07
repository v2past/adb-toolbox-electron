import { chmod } from 'fs/promises';

/**
 * 针对 *nix 系统的可执行权限处理。
 *
 * 在 macOS / Linux 上为指定的 adb 文件添加可执行权限（chmod +x）。
 * 若路径不存在或权限修改失败，不会抛出致命错误，只在控制台记录。
 */
export async function ensureExecutablePermissions(adbPath: string): Promise<void> {
  if (process.platform === 'win32') {
    return;
  }

  // 对于通过 PATH 解析的 "adb" 之类的情况，这里没有实际路径可改，直接跳过。
  if (!adbPath || !adbPath.includes('/')) {
    return;
  }

  try {
    await chmod(adbPath, 0o755);
  } catch (error) {
    // 权限不足或文件不存在时不打断主流程，仅输出调试信息。
    // eslint-disable-next-line no-console
    console.warn('[adb-toolbox] 修改 ADB 可执行权限失败:', error);
  }
}
