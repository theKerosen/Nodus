import asyncio

class TaskManager:
    def __init__(self, tickrate):
        self.tickrate = tickrate
        self.tasks = []
        self.new_tasks = []
        self.scheduled_tasks = []
        self.task_result = {}

    async def add_task(self, task, quiet=False, *args):
        self.new_tasks.append([task, args, quiet])
        while task.__name__ not in self.task_result:
            await asyncio.sleep(0.1)
        return self.task_result.pop(task.__name__)

    async def schedule_task(self, task, delay_ticks, quiet=False, *args):
        self.scheduled_tasks.append((self.tickrate.tick_count + delay_ticks, task, args, quiet))

    def update_tasks(self):
        self.tasks.extend(self.new_tasks)
        self.new_tasks.clear()

        for scheduled_tick, task, args, quiet in self.scheduled_tasks:
            if self.tickrate.tick_count >= scheduled_tick:
                self.tasks.append([task, args, quiet])
        self.scheduled_tasks = [
            (scheduled_tick, task, args, quiet)
            for scheduled_tick, task, args, quiet in self.scheduled_tasks
            if self.tickrate.tick_count < scheduled_tick
        ]

    async def process_task(self):
        if self.tasks:
            task, args, quiet = self.tasks.pop(0)
            if not quiet:
                self.tickrate.console.log(f"@ {task.__name__} #{self.tickrate.tick_count}> Processing task")
            try:
                result = await task(*args)
                if result:
                    if not quiet:
                        self.tickrate.console.log(f'@ {task.__name__}> Returned -> "{result}"')
                        self.tickrate.console.log(f"@ {task.__name__}> Removing task.")
                    self.tickrate.completed_tasks += 1 if not quiet else 0
                    self.task_result[task.__name__] = result
                    self.tickrate.update_last_relevant_info()
            except Exception as e:
                if not quiet:
                    self.tickrate.console.log(f"@ {task.__name__}> Error in task:\n{e}")
                self.task_result[task.__name__] = ""
                self.tickrate.update_last_relevant_info()
