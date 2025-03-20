#include "commands_lua.h"
#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>

int lua_reload_scripts(lua_State * L) {
  lua_pushstring(L, "Script reloading temporarily disabled");
  return 1;
}

int lua_send_response(lua_State * L) {
  const char * response = luaL_checkstring(L, 1);
  int client_fd = luaL_checkinteger(L, 2);
  send_response(client_fd, response);
  return 0;
}

int lua_tickrate_get(lua_State * L) {
  Tickrate * t = (Tickrate * ) lua_touserdata(L, lua_upvalueindex(1));
  lua_pushnumber(L, t -> current_rate);
  return 1;
}
