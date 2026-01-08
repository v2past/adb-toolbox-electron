# scrcpy 诊断工具

当遇到虚拟投屏问题时，可以使用这些诊断工具来排查问题。

## macOS 诊断

在 macOS 上运行以下命令：

```bash
cd /path/to/adb-toolbox-electron
chmod +x scripts/diagnose-macos.sh
./scripts/diagnose-macos.sh
```

或者直接运行：

```bash
bash scripts/diagnose-macos.sh
```

## Windows 诊断

在 Windows 上，双击运行：

```
scripts\diagnose-windows.bat
```

或在命令行中运行：

```cmd
scripts\diagnose-windows.bat
```

## 常见问题

### macOS 闪退问题

1. **确保已安装 scrcpy**：
   ```bash
   brew install scrcpy
   ```

2. **检查应用日志**：
   ```bash
   ~/Library/Logs/ADB Toolbox/
   ```

3. **检查 scrcpy 权限**：
   ```bash
   chmod +x /Applications/ADB\ Toolbox.app/Contents/Resources/scrcpy/darwin/scrcpy
   ```

### Windows 闪退问题

1. **检查依赖库**：
   - 确保 `vendor\scrcpy\win32\` 目录下有所有必需的 DLL 文件
   - 检查 `SDL2.dll`、`avcodec-61.dll`、`avformat-61.dll` 等是否存在

2. **检查应用日志**：
   ```
   %APPDATA%\adb-toolbox-electron\logs\
   ```

3. **检查 ADB 连接**：
   ```cmd
   adb devices
   ```

## 手动测试 scrcpy

### macOS

```bash
# 列出设备
adb devices

# 启动 scrcpy（替换 <device_id> 为实际设备 ID）
scrcpy -s <device_id>
```

### Windows

```cmd
# 列出设备
adb devices

# 启动 scrcpy（替换 <device_id> 为实际设备 ID）
vendor\scrcpy\win32\scrcpy.exe -s <device_id>
```

## 获取帮助

如果诊断工具无法解决问题，请提供以下信息：

1. 诊断工具的完整输出
2. 应用日志文件内容
3. 设备型号和 Android 版本
4. macOS 或 Windows 版本

## 相关资源

- [scrcpy 官方文档](https://github.com/Genymobile/scrcpy)
- [ADB 官方文档](https://developer.android.com/studio/command-line/adb)
