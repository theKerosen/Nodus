class BaseCommand:
    def execute(self, tickrate, request, writer):
        raise NotImplementedError("Execute method not implemented.")
