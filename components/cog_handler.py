import os
from discord.ext import commands


class Handler:
    def __init__(self, console):
        self.console = console

    async def setup(self, client):
        for file in os.listdir(f"{os.getcwd()}/cogs"):
            if os.path.isdir(f"{os.getcwd}/cogs"):
                return
            if file.endswith(".py"):
                await client.load_extension(f"cogs.{file[:-3]}")
                self.console.log(f'{self.__class__.__name__}> Command "{file}" loaded.')
        return True
