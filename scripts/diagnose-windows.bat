@echo off
echo === ADB Toolbox scrcpy 诊断工具 ===
echo.

echo 1. 检查 scrcpy 是否存在...
if exist "vendor\scrcpy\win32\scrcpy.exe" (
    echo [OK] scrcpy 已安装: vendor\scrcpy\win32\scrcpy.exe
) else (
    echo [ERROR] scrcpy 不存在
    echo 预期路径: vendor\scrcpy\win32\scrcpy.exe
)
echo.

echo 2. 检查 scrcpy 依赖库...
if exist "vendor\scrcpy\win32\SDL2.dll" (
    echo [OK] SDL2.dll 存在
) else (
    echo [ERROR] SDL2.dll 不存在
)
if exist "vendor\scrcpy\win32\avcodec-61.dll" (
    echo [OK] avcodec-61.dll 存在
) else (
    echo [ERROR] avcodec-61.dll 不存在
)
if exist "vendor\scrcpy\win32\avformat-61.dll" (
    echo [OK] avformat-61.dll 存在
) else (
    echo [ERROR] avformat-61.dll 不存在
)
echo.

echo 3. 检查 ADB 设备连接...
where adb >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] ADB 已安装
    adb devices
) else (
    echo [ERROR] ADB 未安装或不在 PATH 中
)
echo.

echo 4. 测试 scrcpy 启动...
if exist "vendor\scrcpy\win32\scrcpy.exe" (
    for /f "tokens=1" %%i in ('adb devices ^| findstr /v "List of devices" ^| findstr /v "^$"') do (
        set DEVICE_ID=%%i
        goto :found_device
    )
    :found_device
    if defined DEVICE_ID (
        echo 尝试启动 scrcpy（设备: %DEVICE_ID%）...
        vendor\scrcpy\win32\scrcpy.exe -s %DEVICE_ID% --no-display 2>&1
        if %errorlevel% equ 0 (
            echo [OK] scrcpy 启动成功
        ) else (
            echo [ERROR] scrcpy 启动失败（退出码: %errorlevel%）
        )
    ) else (
        echo 无法测试（未连接设备）
    )
) else (
    echo 无法测试（scrcpy 不存在）
)
echo.

echo === 诊断完成 ===
echo.
echo 如果遇到问题，请检查：
echo 1. 确保 vendor\scrcpy\win32\ 目录下有所有必需的文件
echo 2. 确保设备已连接并开启 USB 调试
echo 3. 检查应用日志: %APPDATA%\adb-toolbox-electron\logs\
pause
