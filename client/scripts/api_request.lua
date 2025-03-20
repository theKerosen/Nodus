local function api_request(token, method, endpoint, body)
    local headers_table = {
        ["Authorization"] = token,
        ["Content-Type"] = "application/json"
    }
    local headers_array = {}
    for key, value in pairs(headers_table) do
        table.insert(headers_array, key .. ": " .. value)
    end
    local url = "https://discord.com/api/v10" .. endpoint
    local data = body
    if type(body) == "table" then
        data = json_encode(body)
    end

    local status, response_or_err =
        pcall(
            function()
                return request(method, url, data, headers_array)
            end
        )

    if not status then
        local err_msg = tostring(response_or_err)
        if err_msg:match("Operation timed out") then
            return '{"status":"error","message":"Request timed out"}'
        else
            return '{"status":"error","message":"Error making API request: ' .. err_msg .. '"}'
        end
    end
    local response = response_or_err
    if not response then
        return '{"status":"error","message":"Error making API request: null response"}'
    end
    if type(response) == "string" then
        return response
    elseif type(response) == "table" and json_encode then
        return json_encode(response)
    else
        return '{"status":"error","message":"Invalid response type"}'
    end
end

function main(custom_args)
    local token = custom_args.token
    local method = custom_args.method:upper()
    local endpoint = custom_args.endpoint
    local body = custom_args.body or ""
    return api_request(token, method, endpoint, body)
end
