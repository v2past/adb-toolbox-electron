import { app } from 'electron';
import { join } from 'path';
import { access } from 'fs/promises';
import { constants as fsConstants } from 'fs';

/**
 * 解析当前平台下 ADB 可执行文件路径。
 *
 * 优先级：
 * 1. 用户设置中的自定义路径（customPath 参数）；
 * 2. 打包内置的 platform-tools：process.resourcesPath/platform-tools/<platform>/adb[.exe]；
 * 3. 开发环境下的 vendor/platform-tools/<platform>/adb[.exe]；
 * 4. 常见系统安装路径（/usr/local/bin/adb 等）；
 * 5. 直接使用二进制名称，让操作系统通过 PATH 查找。
 */
export async function resolveAdbExecutable(customPath?: string): Promise<string> {
  if (customPath && customPath.trim()) {
    return customPath.trim();
  }

  const isWindows = process.platform === 'win32';
  const binaryName = isWindows ? 'adb.exe' : 'adb';
  const platformSegment = process.platform; // win32 / darwin / linux

  const candidates: string[] = [];

  // 1) 打包后的内置 platform-tools，位于 resources/platform-tools 下
  const resourcesDir = process.resourcesPath;
  candidates.push(
    join(resourcesDir, 'platform-tools', platformSegment, binaryName),
    join(resourcesDir, 'platform-tools', binaryName),
  );

  // 2) 开发环境下的 vendor/platform-tools 目录
  const appPath = app.getAppPath();
  candidates.push(
    join(appPath, 'vendor', 'platform-tools', platformSegment, binaryName),
    join(appPath, '..', 'vendor', 'platform-tools', platformSegment, binaryName),
  );

  // 3) 常见 *nix 安装路径
  if (!isWindows) {
    candidates.push('/usr/local/bin/adb', '/usr/bin/adb');
  }

  for (const p of candidates) {
    try {
      // 在 Windows 上 X_OK 会退化为存在性检查；在 *nix 上则会校验可执行权限
      await access(p, fsConstants.X_OK);
      return p;
    } catch {
      // 继续尝试下一个候选路径
    }
  }

  // 兜底：让操作系统通过 PATH 查找 adb/adb.exe
  return binaryName;
}
