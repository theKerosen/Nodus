#include "json_lua.h"
#include "../../src/json/json.h"
#include "../../src/logging/logging.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>


int lua_json_encode(lua_State * L) {
  JSONObject * obj = NULL;

  if (lua_isstring(L, 1)) {
    const char * str = lua_tostring(L, 1);
    lua_pushstring(L, str);
    return 1;
  }

  if (!lua_istable(L, 1)) {
    lua_pushnil(L);
    lua_pushstring(L, "Expected table or string");
    return 2;
  }

  obj = lua_table_to_json(L, 1);
  if (!obj) {
    lua_pushnil(L);
    lua_pushstring(L, "Failed to convert table to JSON");
    return 2;
  }

  char * json_str = json_encode(obj);
  if (!json_str) {
    free_json_object(obj);
    lua_pushnil(L);
    lua_pushstring(L, "JSON encoding failed");
    return 2;
  }

  lua_pushstring(L, json_str);
  free(json_str);
  free_json_object(obj);
  return 1;
}

JSONObject * lua_table_to_json(lua_State * L, int index) {
  JSONObject * obj = create_json_object();
  if (!obj) return NULL;

  lua_pushvalue(L, index);
  lua_pushnil(L);

  while (lua_next(L, -2) != 0) {
    const char * key = luaL_checkstring(L, -2);

    if (lua_isstring(L, -1)) {
      const char * value = lua_tostring(L, -1);
      add_json_pair(obj, key, value, false);
    } else if (lua_isnumber(L, -1)) {
      double num = lua_tonumber(L, -1);
      char buf[64];
      snprintf(buf, sizeof(buf), "%.16g", num);
      add_json_pair(obj, key, buf, false);
    } else if (lua_isboolean(L, -1)) {
      const char * value = lua_toboolean(L, -1) ? "true" : "false";
      add_json_pair(obj, key, value, false);
    } else if (lua_istable(L, -1)) {
      JSONObject * nested = lua_table_to_json(L, lua_gettop(L));
      if (nested) {
        char * nested_str = json_encode(nested);
        if (nested_str) {
          add_json_pair(obj, key, nested_str, true);
          free(nested_str);
        }
        free_json_object(nested);
      }
    }

    lua_pop(L, 1);
  }

  lua_pop(L, 1);
  return obj;
}

int lua_json_decode(lua_State * L) {
  const char * json_str = luaL_checkstring(L, 1);

  JSONObject * obj = json_decode(json_str);
  if (!obj) {
    log_error("Failed to parse JSON: %s", json_str);
    lua_pushnil(L);
    lua_pushstring(L, "Failed to parse JSON");
    return 2;
  }

  lua_newtable(L);
  JSONPair * pair = obj -> head;
  while (pair) {
    if (pair -> is_nested) {
      JSONObject * nested = json_decode(pair -> value);
      if (nested) {
        lua_newtable(L);
        JSONPair * nested_pair = nested -> head;
        while (nested_pair) {
          lua_pushstring(L, nested_pair -> value);
          lua_setfield(L, -2, nested_pair -> key);
          nested_pair = nested_pair -> next;
        }
        lua_setfield(L, -2, pair -> key);
        free_json_object(nested);
      }
    } else {
      lua_pushstring(L, pair -> value);
      lua_setfield(L, -2, pair -> key);
    }
    pair = pair -> next;
  }

  free_json_object(obj);
  return 1;
}

int lua_get_json_value(lua_State * L) {

  const char * json_str = luaL_checkstring(L, 1);
  const char * key = luaL_checkstring(L, 2);

  JSONObject * obj = json_decode(json_str);
  if (!obj) {
    lua_pushnil(L);
    lua_pushstring(L, "Invalid JSON input");
    return 2;
  }

  const char * value = get_json_value(obj, key);
  if (value) {
    lua_pushstring(L, value);
  } else {
    lua_pushnil(L);
  }

  free_json_object(obj);
  return 1;
}
