# components/socket.py
import asyncio
import json
import traceback

class SocketHandler:
    def __init__(self, host='localhost', port=12345, command_handler=None):
        self.host = host
        self.port = port
        self.command_handler = command_handler

    async def socket_listener(self):
        self.command_handler.tickrate.console.log("Socket server starting...")
        server = await asyncio.start_server(self.handle_client, self.host, self.port)
        async with server:
            await server.serve_forever()

    async def handle_client(self, reader, writer):
        data = await reader.read(1000)
        message = data.decode()
        try:
            self.command_handler.tickrate.console.log(f"Received command: {message}")
            request = json.loads(message)
            await self.command_handler.handle_request(request, writer)
        except Exception as e:
            error_msg = traceback.format_exc()
            writer.write(f"Error: {error_msg}".encode())
            self.command_handler.tickrate.console.log(f"Error handling command: {error_msg}")

        await writer.drain()
        writer.close()
