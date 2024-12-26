# components/commands/stop_server.py
from ..base_command import BaseCommand
import json
import sys


class StopServer(BaseCommand):
    async def execute(self, tickrate, request, writer):
        response = {"status": "success", "message": "Server stopping"}
        writer.write(json.dumps(response).encode())
        await writer.drain()
        await tickrate.stop()
