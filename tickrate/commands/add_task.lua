function add_task(args, client_fd, request_id)
    if type(args) ~= "table" then
        return json_encode(
            {
                id = request_id,
                type = "error",
                data = { message = "Invalid args: Expected table, got " .. type(args) }
            }
        )
    end

    local task_name = args.task_name
    local task_body = args.task_body
    local custom_args = args.custom_args or {}

    if type(task_name) ~= "string" then
        return json_encode(
            {
                id = request_id,
                type = "error",
                data = { message = "Invalid task_name format: Expected string, got " .. type(task_name) }
            }
        )
    end

    if type(task_body) ~= "string" then
        return json_encode(
            {
                id = request_id,
                type = "error",
                data = { message = "Invalid task_body format: Expected string, got " .. type(task_body) }
            }
        )
    end

    local validated_args = {}
    for k, v in pairs(custom_args) do
        validated_args[k] = v
    end

    local env = {
        json_encode = json_encode,
        json_ecode = json_decode,
        request = request,
        pairs = pairs,
        ipairs = ipairs,
        table = table,
        type = type,
        tostring = tostring,
        select = select,
        pcall = pcall,
        print = print
    }

    local chunk, err = load(task_body, "task_" .. task_name, "t", env)
    if not chunk then
        return json_encode(
            {
                id = request_id,
                type = "error",
                data = { message = "Compilation error: " .. tostring(err) }
            }
        )
    end

    local success, err = pcall(chunk)
    if not success then
        return json_encode(
            {
                id = request_id,
                type = "error",
                data = { message = "Runtime error: " .. tostring(err) }
            }
        )
    end

    if type(env.main) ~= "function" then
        return json_encode(
            {
                id = request_id,
                type = "error",
                data = { message = "No main function defined" }
            }
        )
    end

    local success, result = pcall(env.main, validated_args)
    if not success then
        return json_encode(
            {
                id = request_id,
                type = "error",
                data = { message = "Execution error: " .. tostring(result) }
            }
        )
    end

    local response
    if type(result) == "table" then
        response = json_encode(result)
    elseif type(result) == "string" then
        response = result
    else
        response = json_encode({ status = "success", data = tostring(result) })
    end

    return json_encode(
        {
            id = request_id,
            type = "task_result",
            data = response
        }
    )
end
