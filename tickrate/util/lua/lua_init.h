#ifndef LUA_INIT_H
#define LUA_INIT_H

#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>
#include "../../src/tickrate/tickrate.h"

// Forward declarations for Lua callbacks
int lua_tickrate_get(lua_State *L);
int lua_reload_scripts(lua_State *L);
int lua_send_response(lua_State *L);

typedef struct LuaEnvironment {
    lua_State *L;
    Tickrate* tickrate;
} LuaEnvironment;

LuaEnvironment* lua_environment_create(Tickrate *t);
void lua_environment_destroy(LuaEnvironment *env);
void lua_register_core_functions(LuaEnvironment *env);

#endif
