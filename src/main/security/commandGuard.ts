import type { ChildProcess } from 'child_process';

export interface CommandValidationOptions {
  /**
   * 黑名单命令或关键字列表，例如：rm、:(){:|:&};:、管道符等。
   */
  blacklist?: string[];

  /**
   * 单个参数的最大长度，用于避免传入过长的恶意 payload。
   */
  maxArgLength?: number;
}

/**
 * 默认黑名单关键字及序列。
 *
 * 注意：这里只是基础拦截，真正的安全性还依赖于调用方正确拆分 command/args，
 * 并避免把整行 shell 字符串直接传入。
 */
export const defaultBlacklist: string[] = [
  'reboot bootloader',
  ':(){:|:&};:',
  '&&',
  '||',
  '|',
  ';',
  '>',
  '>>',
  '<',
  '$(',
  '${',
];

const DANGEROUS_OPERATORS = ['&&', '||', '|', ';', '&', '>', '>>', '<'];
const DANGEROUS_TOKENS = new Set(['rm', 'mkfs', 'format']);

/**
 * 对 ADB 命令及参数进行基础校验，防止明显的命令注入。
 *
 * - 对 command 和每个 arg 做长度检查；
 * - 拦截危险的关键字（rm / reboot bootloader / mkfs / format 等）；
 * - 禁止出现典型的 shell 运算符（&, |, ;, &&, ||, >, >>, <, ${} 等）。
 *
 * 该函数只关注“形态安全”，并不判断业务是否合法。
 * 发现风险时将抛出 Error，由上层捕获并包装为统一的错误返回。
 */
export function validateAdbCommand(
  command: string,
  args: string[] = [],
  options: CommandValidationOptions = {},
): void {
  const { blacklist = defaultBlacklist, maxArgLength = 1024 } = options;

  const tokens = [command, ...args].filter((t) => t != null) as string[];

  for (const token of tokens) {
    if (token.length === 0) continue;

    if (token.length > maxArgLength) {
      const error = new Error('ADB 命令参数过长，已被拒绝');
      (error as any).code = 'ADB_ARG_TOO_LONG';
      (error as any).details = { token };
      throw error;
    }

    // 黑名单关键字匹配（完整 token）
    const lower = token.toLowerCase();
    if (DANGEROUS_TOKENS.has(lower)) {
      const error = new Error(`检测到高危命令片段: "${token}"`);
      (error as any).code = 'ADB_DANGEROUS_TOKEN';
      (error as any).details = { token };
      throw error;
    }

    // 组合关键字，例如 reboot bootloader
    if (lower === 'bootloader' && tokens.map((t) => t.toLowerCase()).includes('reboot')) {
      const error = new Error('禁止执行 reboot bootloader 等高危命令');
      (error as any).code = 'ADB_DANGEROUS_REBOOT';
      throw error;
    }

    // 黑名单子串（如 :(){:|:&};:）
    for (const b of blacklist) {
      if (!b) continue;
      if (token.includes(b)) {
        const error = new Error(`检测到危险片段: "${b}"`);
        (error as any).code = 'ADB_BLACKLIST_HIT';
        (error as any).details = { token, blacklist: b };
        throw error;
      }
    }

    // 禁止典型 shell 运算符
    for (const op of DANGEROUS_OPERATORS) {
      if (token.includes(op)) {
        const error = new Error(`命令中包含非法运算符 "${op}"，已被拦截`);
        (error as any).code = 'ADB_SHELL_OPERATOR_FORBIDDEN';
        (error as any).details = { token, operator: op };
        throw error;
      }
    }

    // 简单字符白名单：限制控制字符，避免换行等被注入。
    for (const ch of token) {
      const code = ch.charCodeAt(0);
      if (code < 32) {
        const error = new Error('命令参数中包含不可见控制字符，已被拦截');
        (error as any).code = 'ADB_INVALID_CHAR';
        (error as any).details = { token };
        throw error;
      }
    }
  }
}

/**
 * 判断命令是否为危险命令。
 *
 * 该函数可供上层在记录操作日志时标记高危操作。
 */
export function isDangerousCommand(command: string, args: string[] = []): boolean {
  try {
    validateAdbCommand(command, args);
    return false;
  } catch {
    return true;
  }
}

/**
 * 为子进程应用超时控制：在约定时间内未退出则主动杀掉。
 *
 * - onTimeoutKill=true 时，超时后会调用 child.kill()；
 * - 同时会在 child 对象上打上 __adbTimeout 标记，调用方可在 'close' 事件中识别。
 */
export function applyCommandTimeout(child: ChildProcess, timeoutMs: number, onTimeoutKill = true): void {
  if (!timeoutMs || timeoutMs <= 0) return;

  const timer = setTimeout(() => {
    (child as any).__adbTimeout = true;
    if (onTimeoutKill) {
      try {
        child.kill();
      } catch {
        // ignore
      }
    }
  }, timeoutMs);

  const clear = () => {
    clearTimeout(timer);
  };

  child.once('exit', clear);
  child.once('error', clear);
}
