# ADB Toolbox Electron

这是一个基于 Electron、React、TypeScript 构建的桌面端 ADB 工具箱。它旨在将复杂的 ADB 命令行操作图形化，为开发者和测试人员提供管理 Android 设备的便捷界面。

本项目骨架由 Aime 自动生成，预置了完整的双进程结构、跨平台打包配置、前端路由与状态管理、IPC 通信约定以及安全机制，可作为二次开发的起点。

## 技术栈与核心依赖

- **框架**: Electron, React 18, TypeScript
- **构建工具**: electron-vite
- **UI 库**: Ant Design 5
- **状态管理**: Zustand
- **路由**: react-router-dom
- **打包**: electron-builder

---

## 快速上手

### 环境要求

- **Node.js**: 推荐 v18 或更高版本。
- **包管理器**: pnpm (或 npm, yarn)。
- **Windows**: 为了正确构建 NSIS 安装包，可能需要安装 [Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)。

### 安装依赖

```bash
cd adb-toolbox-electron
pnpm install
# 或者
# npm install
```

### 开发模式

此命令会启动 Electron 应用并开启主进程与渲染进程的热重载。代码的任何修改都会实时反映在应用中。

```bash
pnpm dev
# 或者
# npm run dev
```

---

## 打包与发布

### 构建与打包命令

执行以下命令，electron-builder 会为当前操作系统（Windows, macOS, Linux）构建并打包应用。

```bash
pnpm electron:build
# 或者
# npm run electron:build
```

- **构建流程**: `electron-vite build` (编译 TS -> JS) + `electron-builder` (打包)。
- **产物位置**: 所有安装包（如 `.exe`, `.dmg`, `.AppImage`）和压缩包（`.zip`）都将生成在项目根目录下的 `release/` 文件夹中。
- **打包目标**:
  - **Windows**: `nsis` (安装程序)
  - **macOS**: `dmg`, `zip`
  - **Linux**: `AppImage`, `zip`

> 当前未启用 `publish` 自动发布配置，`package.json` 中的 `build.publish` 保持为空数组 `[]`，如需接入自动更新请参考 electron-builder 官方文档进行配置。

### 内置 Platform-Tools 使用说明

为了让应用“开箱即用”，用户无需预先安装 Android SDK 或配置 `adb` 环境变量，本项目支持将 `platform-tools` (包含 `adb` 可执行文件) 直接打包进应用。

#### 步骤

1.  **下载官方 Platform-Tools**：
    从 [Android 开发者官网](https://developer.android.com/studio/releases/platform-tools)下载对应您操作系统的 SDK Platform-Tools。

2.  **复制到 `vendor` 目录**：
    在项目根目录下，有一个 `vendor/platform-tools/` 目录，请将下载解压后的 `adb` (以及 `AdbWinApi.dll`, `AdbWinUsbApi.dll` 等相关文件) 复制到对应平台的子目录中。

    目录结构示例如下：

    ```
    adb-toolbox-electron/
    └── vendor/
        └── platform-tools/
            ├── darwin/     # macOS 平台
            │   └── adb
            ├── linux/      # Linux 平台
            │   └── adb
            └── win32/      # Windows 平台
                ├── adb.exe
                ├── AdbWinApi.dll
                └── AdbWinUsbApi.dll
    ```
    > **注意**: `vendor` 目录已在 `.gitignore` 中配置，这些二进制文件不会被提交到 Git 仓库。

3.  **重新打包**：
    执行 `pnpm electron:build`，`electron-builder` 会自动将 `vendor/platform-tools` 目录下的所有文件打包到应用内的 `resources/platform-tools` 目录。

#### 运行时路径解析

应用启动后，会按以下优先级查找 `adb` 可执行文件：

1.  **用户自定义路径**: 用户在“设置”页面指定的 `adbPath`。
2.  **内置 `adb`**: 打包在应用 `resources/platform-tools/<platform>/` 内的 `adb`。
3.  **常见系统路径**: 如 `/usr/local/bin/adb` (仅 macOS/Linux)。
4.  **系统环境变量 `PATH`**: 最后的兜底方案。

#### 常见问题

- **macOS/Linux 权限问题**:
  如果内置的 `adb` 无法执行，可能是因为缺少执行权限。主进程代码会自动尝试为内置 `adb` 添加 `+x` (可执行) 权限。如果遇到问题，也可手动在 `vendor` 目录中提前赋权：`chmod +x vendor/platform-tools/darwin/adb`。

- **Windows 杀毒软件误报**:
  某些杀毒软件可能会将未签名的 `adb.exe` 识别为潜在风险。这是 `adb` 工具的常见情况，建议临时允许或将其添加到信任列表。

### macOS 签名与公证（占位说明）

当前示例工程未开启任何代码签名、Apple ID 账号或公证配置。若要在生产环境中向终端用户分发 dmg/zip 包，建议：

- 使用公司开发者账号申请 Apple Developer ID 证书；
- 在 electron-builder 配置中补充 `mac.identity`, `mac.entitlements` 等字段；
- 按 Apple 官方文档执行签名与 `notarize` 流程，避免 Gatekeeper 阻止运行。

这些步骤因团队证书与发布渠道而异，故此处仅保留占位说明，具体实施可在接入流水线时补充。

---

## 运行时设置与安全策略

### 运行时设置

应用内的 **“设置”** 页面允许用户动态配置以下参数，这些设置会实时生效并持久化保存：

- **ADB 可执行文件路径 (`adbPath`)**: 如果您希望使用系统中已有的特定版本 `adb`，可在此处指定其完整路径。
- **日志默认保存路径**: `adb logcat` 的内容默认保存到此目录。
- **设备自动检测间隔**: 调整轮询 `adb devices` 命令的频率（毫秒）。

### 安全策略

为防止潜在的命令注入风险，主进程对所有 `adb` 调用执行了严格的安全检查：

- **参数化执行**: 所有命令均通过 `child_process.spawn` 执行，将命令和参数严格分离，从根本上避免了 Shell 注入。
- **命令黑名单与运算符拦截**:
  - 禁止直接执行 `rm`, `mkfs` 等高危命令。
  - 拦截 `&&`, `||`, `|`, `;`, `>`, `<`, `$(...)` 等 Shell 控制运算符，防止执行组合命令。
  - 任何触发安全策略的尝试都会被拒绝，并在前端给出明确提示。
- **超时控制**: 每个 ADB 命令都有默认的超时时间（如 30 秒），防止因命令卡死导致应用无响应。
- **统一的 `ApiResponse`**: 所有主进程与渲染进程的通信都遵循 `{ ok: boolean, data?, error? }` 的结构。这使得前端能优雅地处理各种成功、失败和异常情况，并将明确的错误信息（如 `ADB_NOT_FOUND`, `COMMAND_TIMEOUT`）反馈给用户。

---

## 项目结构

```
adb-toolbox-electron/
├── release/                   # 打包后的应用输出目录
├── build/                     # electron-builder 构建资源 (如图标)
│   └── icons/
│       ├── icon.icns          # macOS 图标
│       ├── icon.ico           # Windows 图标
│       └── icon.png           # Linux 图标
├── vendor/                    # 用于放置第三方二进制文件 (不提交到 git)
│   └── platform-tools/
│       ├── darwin/
│       ├── linux/
│       └── win32/
├── src/
│   ├── main/                  # 主进程代码
│   │   ├── services/          # 后端服务 (ADB, 设置, 日志)
│   │   ├── security/          # 安全模块 (命令校验, 黑名单)
│   │   ├── platform/          # 跨平台适配 (路径, 权限)
│   │   ├── index.ts           # 主进程入口
│   │   └── ipc.ts             # IPC 通道注册中心
│   ├── preload/               # 预加载脚本
│   │   └── index.ts           # 暴露 window.api
│   ├── renderer/              # 渲染进程代码 (React 应用)
│   │   ├── src/
│   │   │   ├── pages/         # 路由页面组件
│   │   │   ├── store/         # 全局状态管理 (Zustand)
│   │   │   ├── App.tsx        # 根组件与布局
│   │   │   └── main.tsx       # React 应用入口
│   │   └── index.html         # HTML 入口
│   └── shared/                # 主进程与渲染进程共享代码
│       └── types/
│           └── models.ts      # 共享的 TypeScript 模型接口
├── electron.vite.config.ts    # electron-vite 配置文件
├── tsconfig.json              # TypeScript 配置文件
└── package.json               # 项目依赖、脚本与打包配置
```

## 进程间通信 (IPC) 约定

本项目采用 **RESTful 风格** 的 API 约定来组织主进程与渲染进程之间的 IPC 通道，以提高可读性和可维护性。

- **通信方式**: `ipcRenderer.invoke` (前端) 对应 `ipcMain.handle` (后端)。
- **频道命名**: 采用 `HTTP 方法 + 资源路径` 的形式，例如 `GET /api/devices`。

**核心接口定义：**

渲染进程通过 `window.api` 对象调用这些接口，该对象在 `src/preload/index.ts` 中被安全地暴露给前端。所有接口均返回 `Promise<ApiResponse<T>>`。

- `window.api.getDevices()`: 获取设备列表 (`GET /api/devices`)。
- `window.api.executeAdbCommand(payload)`: 执行 ADB 命令 (`POST /api/adb/execute`)。
- `window.api.getSettings()`: 获取应用配置 (`GET /api/settings`)。
- `window.api.updateSettings(partial)`: 更新应用配置 (`PUT /api/settings`)。
- `window.api.startLogcat(options)`: 启动 logcat 流 (`POST /api/logs/start`)。
- `window.api.stopLogcat()`: 停止 logcat 流 (`POST /api/logs/stop`)。
- `window.api.saveLogs(payload)`: 保存日志到文件 (`POST /api/logs/save`)。
- `window.api.clearLogs()`: 清空内存中的日志缓冲 (`DELETE /api/logs`)。
