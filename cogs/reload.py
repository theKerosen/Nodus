from discord.ext import commands
from components.read_write import DataType
import os


class Reload(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.command()
    async def reload(self, ctx, cog: str):
        try:
            self.bot.unload_extension(f"cogs.{cog}")
            self.bot.load_extension(f"cogs.{cog}")
            await ctx.send(f"Cog {cog} reloaded successfully.")
        except Exception as e:
            await ctx.send(f"Failed to reload cog {cog}.\nError: {e}")


async def setup(bot):
    await bot.add_cog(Reload(bot))
