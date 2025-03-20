#ifndef HTTP_LUA_H
#define HTTP_LUA_H

#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>

int l_http_request(lua_State *L);

#endif // HTTP_LUA_H