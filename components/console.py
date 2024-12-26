import curses
from datetime import datetime

class Console:
    def __init__(self, input_name=""):
        self.input_name = input_name
        self.stdscr = curses.initscr()
        curses.start_color()
        curses.use_default_colors()
        curses.init_pair(1, curses.COLOR_CYAN, -1)
        curses.init_pair(2, curses.COLOR_YELLOW, -1)
        curses.init_pair(3, curses.COLOR_GREEN, -1)
        curses.init_pair(4, curses.COLOR_RED, -1)
        curses.noecho()
        curses.cbreak()
        self.stdscr.keypad(True)
        self.log_lines = []

    def out_info(self, current_info, last_relevant_info):
        self.stdscr.clear()

        current_lines = current_info.split("\n")
        last_relevant_lines = last_relevant_info.split("\n")
        max_lines = max(len(current_lines), len(last_relevant_lines))

        for i in range(max_lines):
            if i < len(current_lines):
                self.stdscr.addstr(
                    i,
                    0,
                    (
                        f"{current_lines[i]}"
                        if len(self.input_name) == 0
                        else f"[{self.input_name}] {current_lines[i]}"
                    ),
                    curses.color_pair(1),
                )
            if i < len(last_relevant_lines):
                self.stdscr.addstr(
                    i, 40, f"{last_relevant_lines[i]}", curses.color_pair(2)
                )

        self.stdscr.addstr(max_lines, 0, "-" * 80, curses.color_pair(3))

        for i, log_line in enumerate(self.log_lines):
            self.stdscr.addstr(max_lines + 1 + i, 0, log_line, curses.color_pair(4))
        self.stdscr.refresh()

    def log(self, message):
        current_time = datetime.now().strftime("%H:%M:%S")
        self.log_lines.append(f"<{current_time}> {message}")
        if len(self.log_lines) > 10:
            self.log_lines.pop(0)
        self.out_info("", "")

    def cleanup(self):
        try:
            curses.nocbreak()
            self.stdscr.keypad(False)
            curses.echo()
            self.stdscr.clear()
            for i, log_line in enumerate(self.log_lines):
                self.stdscr.addstr(i, 0, log_line, curses.color_pair(4))
            self.stdscr.refresh()
        except:
            pass
        finally:
            curses.endwin()
