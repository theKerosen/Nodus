# components/command_handler.py
import os
import importlib
import json
import traceback

class CommandHandler:
    def __init__(self, tickrate):
        self.tickrate = tickrate
        self.commands = self.load_commands()

    def load_commands(self):
        commands = {}
        commands_folder = 'components.commands'
        for filename in os.listdir(commands_folder.replace('.', '/')):
            if filename.endswith('.py') and filename != 'base_command.py' and filename != '__init__.py':
                module_name = filename[:-3]
                module = importlib.import_module(f"{commands_folder}.{module_name}")
                class_name = ''.join(word.title() for word in module_name.split('_'))
                command_class = getattr(module, class_name)
                commands[module_name] = command_class()
                self.tickrate.console.log(f"Command {module_name} loaded.")
        return commands

    async def handle_request(self, request, writer):
        try:
            command = request.get('command')
            self.tickrate.console.log(f"Received command: {json.dumps(request)}")

            if command in self.commands:
                self.tickrate.console.log(f"Executing command: {command}")
                await self.commands[command].execute(self.tickrate, request, writer)
            else:
                writer.write(json.dumps({"status": "error", "message": "Unknown command"}).encode())
                self.tickrate.console.log(f"Unknown command: {command}")

        except Exception as e:
            error_msg = traceback.format_exc()
            self.tickrate.console.log(f"Error handling command: {error_msg}")
            writer.write(json.dumps({"status": "error", "message": error_msg}).encode())
