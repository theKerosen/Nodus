from enum import Enum
from components.tickrate import Tickrate
from components.console import Console
import time
import json
import os


class DataType(Enum):
    JSON = ("json",)
    raw = ("raw",)
    binary = "bin"


class Read:
    def __init__(self, tickrate: Tickrate, console):
        self.tickrate = tickrate
        self.console = console

    async def readf(self, file_path, typeof: DataType, quiet):
        task = await self.tickrate.task_manager.add_task(self.read_handler, quiet, file_path, typeof)
        return task

    async def read_handler(self, file_path, typeof: DataType):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f) if typeof == DataType.JSON else f.read()
        except Exception as e:
            self.console.out_info(
                f"Erro encontrado em {self.__class__.__name__}: \n{e}"
            )

    async def writef(self, file_path, data, typeof: DataType, quiet):
        task = await self.tickrate.task_manager.add_task(self.write_handler, quiet, file_path, data, typeof)
        return task

    async def write_handler(self, file_path, data, typeof: DataType):
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                if typeof == DataType.JSON:
                    json.dump(data, f, ensure_ascii=False, indent=4)
                else:
                    f.write(data)
            return f"Written to {file_path}"
        except Exception as e:
            self.console.out_info(
                f"Erro encontrado em {self.__class__.__name__}: \n{e}"
            )

    async def deletef(self, file_path, quiet):
        task = await self.tickrate.task_manager.add_task(self.delete_handler, quiet, file_path)
        return task

    async def delete_handler(self, file_path):
        try:
            os.remove(file_path)
            return f"Deleted {file_path}"
        except Exception as e:
            self.console.out_info(
                f"Erro encontrado em {self.__class__.__name__}: \n{e}"
            )
