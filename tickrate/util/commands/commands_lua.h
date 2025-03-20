
#ifndef COMMANDS_LUA_H
#define COMMANDS_LUA_H

#include <lua.h>
#include "../../src/tickrate/tickrate.h"


void send_response(int client_fd, const char *response);

int lua_reload_scripts(lua_State *L);
int lua_send_response(lua_State *L);
int lua_tickrate_get(lua_State *L);

#endif
