const net = require('net');

function sendCommand(command) {
    const client = new net.Socket();
    const host = 'localhost';
    const port = 12345;

    client.connect(port, host, () => {
        console.log('Connected to server');
        client.write(JSON.stringify(command));
    });

    client.on('data', (data) => {
        const response = JSON.parse(data.toString());
        console.log('Received:', response);
        client.destroy(); // Close the connection after receiving the response
    });

    client.on('close', () => {
        console.log('Connection closed');
    });

    client.on('error', (err) => {
        console.error('Error:', err.message);
    });
}

// Run Python Code Command
const runPythonCodeCommand = {
    command: 'run_python_code',
    code: `
import asyncio

async def main(tickrate):
    result = {
        "tickrate": str(tickrate.tickrate),
        "task": await tickrate.add_task(tickrate.example_task, False, 1, 2)
    }
    return result
    `
};

// Get Server Status
const getServerStatusCommand = {
    command: 'get_server_status'
};

// Add Task Command
const addTaskCommand = {
    command: 'add_task',
    task_name: 'example_task',
    args: [1, 2]
};

// Stop Server Command
const stopServerCommand = {
    command: 'stop_server'
};

// Send Commands to Test
sendCommand(runPythonCodeCommand);
setTimeout(() => sendCommand(getServerStatusCommand), 2000);
setTimeout(() => sendCommand(addTaskCommand), 4000);
setTimeout(() => sendCommand(stopServerCommand), 6000);
