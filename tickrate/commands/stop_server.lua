function stop_server(_, client_fd)
    send_response("Server is stopping", client_fd)
    os.exit(0)
end
