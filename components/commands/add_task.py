# components/commands/add_task.py
from ..base_command import BaseCommand
import json

class AddTask(BaseCommand):
    async def execute(self, tickrate, request, writer):
        task_name = request.get('task_name')
        args = request.get('args', [])
        if not task_name or not isinstance(task_name, str):
            raise ValueError("Invalid task name")

        task_function = getattr(tickrate, task_name, None)
        if not task_function:
            raise ValueError("Task not found")

        result = await task_function(*args)
        response = {
            "status": "success",
            "result": result
        }
        writer.write(json.dumps(response).encode())
        await writer.drain()
