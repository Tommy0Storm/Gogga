import asyncio
import json
import sys

import websockets


async def main() -> None:
    uri = "ws://localhost:8080/ssh-monitor"

    host = sys.argv[1] if len(sys.argv) > 1 else "192.168.0.130"
    username = sys.argv[2] if len(sys.argv) > 2 else "ubuntu"
    password = sys.argv[3] if len(sys.argv) > 3 else "Pingpong5$%$%"

    async with websockets.connect(uri) as ws:
        await ws.send(
            json.dumps(
                {
                    "type": "hello",
                    "client": "ws_test_client.py",
                    "version": 1,
                    "target": {"host": host},
                }
            )
        )
        await ws.send(json.dumps({"type": "auth", "username": username, "password": password}))
        await ws.send(
            json.dumps(
                {
                    "type": "subscribe",
                    "streams": {"metrics": True, "docker": True, "terminal": True},
                    "intervalMs": 2000,
                }
            )
        )

        got_bridge = False
        got_docker = False
        got_metrics = False

        while True:
            raw = await ws.recv()
            msg = json.loads(raw)
            mtype = msg.get("type")

            if mtype == "bridge_info" and not got_bridge:
                got_bridge = True
                print("Got bridge_info:")
                print(json.dumps(msg, indent=2))

            if mtype == "docker" and not got_docker:
                got_docker = True
                print("Got docker:")
                print(json.dumps(msg, indent=2))

            if mtype == "metrics" and not got_metrics:
                got_metrics = True
                print("Got metrics:")
                print(json.dumps(msg, indent=2))

            if got_bridge and got_docker:
                return


if __name__ == "__main__":
    asyncio.run(main())
