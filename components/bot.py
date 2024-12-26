import os
import asyncio
from discord import CustomActivity
from discord.ext import commands
from components.cog_handler import Handler
from components.tickrate import Tickrate
from components.read_write import Read, DataType
from components.console import Console


class Nodus(commands.Bot):
    def __init__(self, command_prefix, intents, console, tickrate: Tickrate):
        super().__init__(command_prefix=command_prefix, intents=intents)
        self.tickrate = tickrate
        self.console = console
        self.handler = Handler(self.console)
        self.read = Read(self.tickrate, self.console)
        self.console.input_name = self.__class__.__name__
        self.roles = None

    async def setup(self):
        try:
            token = await self.read.readf(
                f"{os.getcwd()}/db/nodus.json", DataType.JSON, True
            )
            self.console.log("@ Nodus > Setting up everything...")
            await self.start(token["token"])
        except Exception as e:
            self.console.log(f"Error during setup: {e}")
            self.console.cleanup()

    async def on_ready(self):
        try:
            self.console.log_lines.pop(0)
            self.console.log("@ Nodus> Eh, I am online.")
            await self.tickrate.task_manager.add_task(self.presence, True)
            await self.tickrate.task_manager.add_task(self.handler.setup, False, self)
        except Exception as e:
            self.console.log(f"Error in on_ready: {e}")

    async def presence(self):
        try:
            activity = CustomActivity(name=f"{self.tickrate.real_tickrate} ticks/s")
            await self.change_presence(activity=activity)
            await self.tickrate.task_manager.schedule_task(
                self.presence, self.tickrate.seconds_to_ticks(3), True
            )
            return True
        except Exception as e:
            self.console.log(f"Error in presence task: {e}")
            return False
