from discord.ext import commands
from discord import Embed, Colour
from components.read_write import DataType
import os
import asyncio
import psutil
import time


class TickrateInformation(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.start_time = time.time()

    def format_tick_time(self, tick_time):
        if tick_time >= 1:
            return f"{tick_time:.0f}ms"
        elif tick_time >= 1e-3:
            return f"{tick_time * 1e3:.0f}µs"
        else:
            return f"{tick_time * 1e6:.0f}ns"

    def get_uptime(self):
        current_time = time.time()
        uptime_seconds = int(current_time - self.start_time)
        uptime_str = time.strftime("%H:%M:%S", time.gmtime(uptime_seconds))
        return uptime_str

    def get_system_usage(self):
        cpu_usage = psutil.cpu_percent(interval=1)
        memory_info = psutil.virtual_memory()
        memory_usage = memory_info.percent
        return cpu_usage, memory_usage

    @commands.command()
    async def tps(self, context):
        try:
            avg_tick_time = self.format_tick_time(self.bot.tickrate.avg)
            embed = (
                Embed(color=Colour.dark_blue())
                .add_field(
                    name="Tickrate/s",
                    value=f"{self.bot.tickrate.real_tickrate:.0f} ticks/s",
                )
                .add_field(name="Tick n°", value=f"#{self.bot.tickrate.tick_count}")
                .add_field(name="Tick avg", value=f"≈ {avg_tick_time}")
            )
            await context.send(embed=embed)

        except Exception as e:
            self.bot.console.log(f"Error: {e}")

    @commands.command()
    async def utime(self, context):
        try:
            uptime_str = self.get_uptime()
            embed = Embed(description=uptime_str, color=Colour.green())
            await context.send(embed=embed)

        except Exception as e:
            self.bot.console.log(f"Error: {e}")

    @commands.command()
    async def hinfo(self, context):
        try:
            cpu_usage, memory_usage = self.get_system_usage()
            embed = (
                Embed(color=Colour.orange())
                .add_field(name="CPU", value=f"{cpu_usage}%")
                .add_field(name="Mem.", value=f"{memory_usage}%")
            )
            await context.send(embed=embed)

        except Exception as e:
            self.bot.console.log(f"Error: {e}")

    @commands.command()
    async def tstats(self, context):
        description = f"""(**{self.bot.tickrate.all_tasks}**) total
        (**{len(self.bot.tickrate.scheduled_tasks)}**) scheduled
        (**{self.bot.tickrate.completed_tasks}**) completed
        (**{len(self.bot.tickrate.tasks)}**) pending
        """
        try:
            embed = Embed(title="Tasks", color=Colour.blue(), description=description)
            await context.send(embed=embed)

        except Exception as e:
            self.bot.console.log(f"Error: {e}")

    @commands.command()
    async def logs(self, context):
        try:
            logs = "\n".join(self.bot.console.log_lines[-10:])
            embed = Embed(color=Colour.blurple()).add_field(
                name="Logs", value=f"```\n{logs}\n```"
            )
            await context.send(embed=embed)

        except Exception as e:
            self.bot.console.log(f"Error: {e}")


async def setup(bot):
    await bot.add_cog(TickrateInformation(bot))
