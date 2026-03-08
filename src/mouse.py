# pyautogui.click(1967, 946)
# pyautogui.click(1967, 946)

import sys
import json
import struct
import time
import pyautogui

# 配置 PyAutoGUI
# 防止移动速度过快导致操作失败，设置一个极小的停顿（秒）
pyautogui.PAUSE = 0.1
# 如果移动到屏幕边缘失败，启用此选项（某些 Linux 发行版需要）
pyautogui.FAILSAFE = True


def get_message():
    """
    读取 Native Messaging 格式的消息
    """
    try:
        # 1. 读取 4 字节长度
        raw_length = sys.stdin.buffer.read(4)
        if len(raw_length) == 0:
            return None

        # 2. 解包小端序整数
        message_length = struct.unpack("<I", raw_length)[0]

        # 3. 读取 JSON 内容
        message_data = sys.stdin.buffer.read(message_length)
        if len(message_data) != message_length:
            return None

        return json.loads(message_data.decode("utf-8"))
    except Exception as e:
        print(f"Error reading message: {e}", file=sys.stderr)
        return None


def main():
    # 等待一小会儿，确保浏览器连接已建立
    time.sleep(0.1)

    while True:
        data = get_message()
        if data is None:
            break

        action = data.get("action")
        x = data.get("x")
        y = data.get("y")

        print(
            f"[PyAutoGUI] Received: Action={action}, Target=({x}, {y})", file=sys.stderr
        )

        if action == "click":
            try:
                # 获取当前屏幕分辨率，防止坐标溢出（可选的安全检查）
                screen_width, screen_height = pyautogui.size()

                # 限制坐标在屏幕范围内
                target_x = max(0, min(x, screen_width - 1))
                target_y = max(0, min(y, screen_height - 1))

                if target_x != x or target_y != y:
                    print(
                        f"[Warning] Coordinates adjusted to fit screen: ({target_x}, {target_y})",
                        file=sys.stderr,
                    )

                # 1. 移动鼠标 (duration=0 表示瞬间移动)
                pyautogui.moveTo(target_x, target_y, duration=0)

                # 2. 点击左键
                pyautogui.click()

                print("[Success] Click executed.", file=sys.stderr)

            except Exception as e:
                print(f"[Error] Click failed: {e}", file=sys.stderr)

        # 处理完一次请求后退出
        # 因为 background.js 是 "发送即断开" 模式，每次点击都会新建一个进程
        break


if __name__ == "__main__":
    main()
