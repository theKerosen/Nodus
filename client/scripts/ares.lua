function ares(url)
    local status, response_or_err =
        pcall(
            function()
                return request("GET", url, nil, {})
            end
        )
    if not status then
        return { status = "error", message = "Error making API request: " .. tostring(response_or_err) }
    end
    local response = response_or_err
    if not response then
        return { status = "error", message = "Error making API request: null response" }
    end
    return response
end

function main(custom_args)
    local result = ares(custom_args.url)
    return result
end
