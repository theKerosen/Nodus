#ifndef COMMANDS_H
#define COMMANDS_H

#include "../tickrate/tickrate.h"
#include "../task/task_manager.h"
#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>
#include <lualib.h>

#define BUFFER_SIZE 16384

int load_commands(const char *directory, lua_State *L);
const char* execute_dynamic_task(const char *task_name, Tickrate *tickrate);
void execute_command(const char *command,
                    char *cleaned,
                    const char *args_json,
                    int socket,
                    lua_State *L,
                    Tickrate *tickrate,
                    const char *request_id);

#endif
