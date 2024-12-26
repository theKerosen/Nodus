# components/commands/run_python_code.py
from ..base_command import BaseCommand
import asyncio
import json

class RunPythonCode(BaseCommand):
    async def execute(self, tickrate, request, writer):
        code = request.get('code')
        try:
            local_env = {
                "console_log": tickrate.console.log,
                "tickrate": tickrate,
                "asyncio": asyncio,
                **{method_name: getattr(tickrate, method_name) for method_name in dir(tickrate) if callable(getattr(tickrate, method_name)) and not method_name.startswith("__")}
            }

            exec(code, {}, local_env)

            if 'main' not in local_env or not callable(local_env['main']):
                raise ValueError("Code must define a callable 'main' function")

            main_coro = local_env['main'](tickrate)
            result = await main_coro

            response = {
                "status": "success",
                "result": result
            }

            writer.write(json.dumps(response).encode())
            await writer.drain()
        except Exception as e:
            response = {
                "status": "error",
                "message": str(e)
            }

            tickrate.console.log(f"Error executing code: {e}")
            writer.write(json.dumps(response).encode())
            await writer.drain()
