function get_server_status(_, client_fd)
    local status = "Server is running"
    send_response("Server status: " .. status, client_fd)
end
