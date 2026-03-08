import sys
import json
import struct
import time
import pyautogui

pyautogui.PAUSE = 0.1
pyautogui.FAILSAFE = True


def get_message():
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

                pyautogui.moveTo(target_x, target_y, duration=0)
                pyautogui.click()
                print("[Success] Click executed.", file=sys.stderr)
            except Exception as e:
                print(f"[Error] Click failed: {e}", file=sys.stderr)
        break


if __name__ == "__main__":
    main()
