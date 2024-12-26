from discord.ext import commands
from components.read_write import DataType
import os


class Join(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_member_join(self, member):
        try:
            role_list: dict = await self.bot.read.readf(
                f"{os.getcwd()}/db/roles.json", DataType.JSON, True
            )
            role_id = int(role_list.get(str(member.guild.id), {}).get("member"))
            role = member.guild.get_role(role_id)
            if role:
                await member.add_roles(role)
        except Exception as e:
            self.bot.console.log(f"Error: {e}")


async def setup(bot):
    await bot.add_cog(Join(bot))
