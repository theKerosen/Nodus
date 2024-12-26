import asyncio
import discord
from components.tickrate import Tickrate
from components.bot import Nodus
from components.console import Console
from components.command_handler import CommandHandler
from components.socket import SocketHandler

class Main:
    def __init__(self):
        self.console = Console()
        self.tickrate = Tickrate(128, self.console)
        self.command_handler = CommandHandler(tickrate=self.tickrate)
        self.socket_handler = SocketHandler(command_handler=self.command_handler)
        self.tickrate.set_socket_handler(self.socket_handler)
        self.client = Nodus(".", discord.Intents.all(), self.console, self.tickrate)

    async def main(self):
        try:
            tick_system_task = asyncio.create_task(self.tickrate.run())
            await self.client.setup()
            await tick_system_task
        except KeyboardInterrupt:
            self.console.log("KeyboardInterrupt detected, shutting down.")
        except asyncio.exceptions.CancelledError as e:
            self.console.log(f"Asyncio CancelledError: {e}")
        finally:
            self.console.cleanup()
            await self.tickrate.stop()

if __name__ == "__main__":
    main_instance = Main()
    asyncio.run(main_instance.main())
