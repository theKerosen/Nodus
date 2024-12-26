from ..base_command import BaseCommand
import json

class GetServerStatus(BaseCommand):
    async def execute(self, tickrate, request, writer):
        status = {
            "tickrate": tickrate.tickrate,
            "tasks": [task.name for task in tickrate.tasks]
        }
        response = {
            "status": "success",
            "server_status": status
        }
        writer.write(json.dumps(response).encode())
        await writer.drain()
