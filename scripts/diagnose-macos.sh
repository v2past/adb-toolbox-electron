#!/bin/bash

echo "=== ADB Toolbox scrcpy 诊断工具 ==="
echo ""

echo "1. 检查 scrcpy 是否已安装..."
if command -v scrcpy &> /dev/null; then
    echo "✓ scrcpy 已安装: $(which scrcpy)"
    echo "  版本: $(scrcpy --version 2>&1 | head -1)"
else
    echo "✗ scrcpy 未安装"
    echo "  请运行: brew install scrcpy"
fi
echo ""

echo "2. 检查应用中的 scrcpy 路径..."
APP_PATH="/Applications/ADB Toolbox.app"
if [ -d "$APP_PATH" ]; then
    echo "✓ 应用已安装: $APP_PATH"
    
    SCRCPY_PATH="$APP_PATH/Contents/Resources/scrcpy/darwin/scrcpy"
    if [ -f "$SCRCPY_PATH" ]; then
        echo "✓ scrcpy 二进制文件存在: $SCRCPY_PATH"
        if [ -x "$SCRCPY_PATH" ]; then
            echo "✓ scrcpy 具有可执行权限"
        else
            echo "✗ scrcpy 缺少可执行权限"
            echo "  请运行: chmod +x '$SCRCPY_PATH'"
        fi
    else
        echo "✗ scrcpy 二进制文件不存在"
        echo "  预期路径: $SCRCPY_PATH"
    fi
else
    echo "✗ 应用未安装"
fi
echo ""

echo "3. 检查动态库依赖..."
if command -v scrcpy &> /dev/null; then
    echo "scrcpy 依赖的动态库:"
    otool -L $(which scrcpy) 2>/dev/null | grep -v "System\|/usr/lib"
else
    echo "无法检查依赖（scrcpy 未安装）"
fi
echo ""

echo "4. 检查 ADB 设备连接..."
if command -v adb &> /dev/null; then
    DEVICES=$(adb devices 2>/dev/null | grep -v "List of devices" | grep -v "^$")
    if [ -n "$DEVICES" ]; then
        echo "✓ 已连接的设备:"
        echo "$DEVICES"
    else
        echo "✗ 未检测到 ADB 设备"
        echo "  请确保设备已连接并开启 USB 调试"
    fi
else
    echo "✗ ADB 未安装"
fi
echo ""

echo "5. 测试 scrcpy 启动..."
if command -v scrcpy &> /dev/null; then
    DEVICE_ID=$(adb devices 2>/dev/null | grep -v "List of devices" | grep -v "^$" | head -1 | awk '{print $1}')
    if [ -n "$DEVICE_ID" ]; then
        echo "尝试启动 scrcpy（设备: $DEVICE_ID）..."
        timeout 3 scrcpy -s "$DEVICE_ID" --no-display 2>&1 | head -20
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 124 ]; then
            echo "✓ scrcpy 启动成功（超时退出）"
        elif [ $EXIT_CODE -eq 0 ]; then
            echo "✓ scrcpy 启动成功"
        else
            echo "✗ scrcpy 启动失败（退出码: $EXIT_CODE）"
        fi
    else
        echo "无法测试（未连接设备）"
    fi
else
    echo "无法测试（scrcpy 未安装）"
fi
echo ""

echo "=== 诊断完成 ==="
echo ""
echo "如果遇到问题，请检查："
echo "1. 确保已安装 Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
echo "2. 安装 scrcpy: brew install scrcpy"
echo "3. 确保设备已连接并开启 USB 调试"
echo "4. 检查应用日志: ~/Library/Logs/ADB Toolbox/"
