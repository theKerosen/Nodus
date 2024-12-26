# components/tickrate.py
import asyncio
import time
from components.task_manager import TaskManager

class Tickrate:
    def __init__(self, tickrate, console):
        self.tickrate = tickrate
        self.tick_interval = 1 / tickrate
        self.completed_tasks = 0
        self.real_tickrate = 0
        self.tick_count = 0
        self.elapsed_time = 0
        self.tick_times = []
        self.avg = 0
        self.last_relevant_info = {
            "tickrate": 0,
            "completed_tasks": 0,
            "all_tasks": 0,
            "ticks": 0,
            "tick_time": 0,
        }
        self.console = console
        self.socket_handler = None
        self.task_manager = TaskManager(self)
        self.running = True

    def set_socket_handler(self, socket_handler):
        self.socket_handler = socket_handler

    def seconds_to_ticks(self, seconds):
        return seconds * self.tickrate

    def update_last_relevant_info(self):
        self.last_relevant_info = {
            "tickrate": self.real_tickrate,
            "completed_tasks": self.completed_tasks,
            "all_tasks": len(self.task_manager.tasks) + len(self.task_manager.new_tasks),
            "ticks": self.tick_count,
            "tick_time": self.elapsed_time,
        }

    def calculate_tickrate(self, start_time):
        end_time = time.time()
        self.elapsed_time = end_time - start_time

        self.tick_times.append(self.elapsed_time)
        if len(self.tick_times) > 10:
            self.tick_times.sort(reverse=True)
            self.tick_times = self.tick_times[:10]

        self.avg = sum(self.tick_times) / len(self.tick_times)
        self.real_tickrate = 1 / self.tick_interval
        self.tick_count += 1

    def display_info(self):
        if self.real_tickrate < self.tickrate:
            self.console.log(f"Tick {self.tick_count}: Warning: Unstable Tickrate system. {self.real_tickrate:.2f} ticks/s")

        self.console.out_info(
            f"Current tickrate: {self.real_tickrate:.2f} ticks/s\n"
            f"Tasks: {len(self.task_manager.tasks)}\n"
            f"Ticks: {self.tick_count}\n"
            f"Tick time: {self.elapsed_time:.5f}ms\n"
            f"Average tick time: {self.avg:.5f}ms",
            f">Summary of the last relevant tick ({self.last_relevant_info['ticks']})\n"
            f"├ Tickrate: {self.last_relevant_info['tickrate']:.2f} ticks/s\n"
            f"├ Tasks: {self.last_relevant_info['completed_tasks']}\n"
            f"└ Tick time: {self.last_relevant_info['tick_time']:.5f}ms",
        )

    async def run(self):
        try:
            if self.socket_handler:
                asyncio.create_task(self.socket_handler.socket_listener())
            while self.running:
                start_time = time.time()
                self.task_manager.update_tasks()
                await self.task_manager.process_task()
                self.calculate_tickrate(start_time)
                self.display_info()
                await asyncio.sleep(max(0, self.tick_interval - self.elapsed_time))
        except KeyboardInterrupt:
            self.console.log("KeyboardInterrupt detected. Shutting down gracefully.")
        finally:
            self.console.cleanup()

    async def stop(self):
        self.running = False
        self.task_manager.tasks.clear()
        self.task_manager.new_tasks.clear()
        self.task_manager.scheduled_tasks.clear()
        self.console.log("Server stopping")

    def get_info(self):
        return {
            "tickrate": self.real_tickrate,
            "completed_tasks": self.completed_tasks,
            "all_tasks": len(self.task_manager.tasks),
            "ticks": self.tick_count,
            "tick_time": self.elapsed_time,
            "avg_tick_time": self.avg,
        }
