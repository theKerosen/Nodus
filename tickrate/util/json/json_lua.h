#ifndef JSON_LUA_H
#define JSON_LUA_H

#include <lua.h>
#include "../../src/json/json.h"

int lua_json_encode(lua_State *L);
int lua_json_decode(lua_State *L);
int lua_get_json_value(lua_State *L);
JSONObject* lua_table_to_json(lua_State *L, int index);

#endif
