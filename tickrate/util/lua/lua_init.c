#include "lua_init.h"
#include "../commands/commands_lua.h"
#include "../print/print_utils.h"
#include "../http/http_lua.h"
#include "../json/json_lua.h"
#include "../../src/logging/logging.h"
#include <stdlib.h>
#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>
#include <stdio.h>
#include <time.h>
#include <string.h>

void custom_log(const char * message) {
  FILE * file = fopen("add_task.log", "a");
  if (file == NULL) {
    fprintf(stderr, "LOG ERROR: Unable to open log file\n");
    return;
  }

  time_t now = time(NULL);
  char * timestamp = ctime( & now);
  timestamp[strlen(timestamp) - 1] = '\0';

  fprintf(file, "[%s] %s\n", timestamp, message);
  fclose(file);
}

static int lua_custom_log(lua_State * L) {
  const char * message = luaL_checkstring(L, 1);
  custom_log(message);
  return 0;
}

extern int luaopen_base(lua_State * L);
extern int luaopen_package(lua_State * L);
extern int luaopen_table(lua_State * L);
extern int luaopen_string(lua_State * L);
extern int luaopen_math(lua_State * L);
extern int luaopen_os(lua_State * L);

LuaEnvironment * lua_environment_create(Tickrate * t) {
  LuaEnvironment * env = malloc(sizeof(LuaEnvironment));
  if (!env) {
    log_error("Failed to allocate Lua environment");
    return NULL;
  }

  env -> L = luaL_newstate();
  env -> tickrate = t;

  if (!env -> L) {
    free(env);
    log_error("Failed to create Lua L");
    return NULL;
  }

  luaL_requiref(env -> L, "package", luaopen_package, 1);
  luaL_requiref(env -> L, "table", luaopen_table, 1);
  luaL_requiref(env -> L, "string", luaopen_string, 1);
  luaL_requiref(env -> L, "math", luaopen_math, 1);
  luaL_requiref(env -> L, "os", luaopen_os, 1);
  luaL_requiref(env -> L, "io", luaopen_io, 1);
  luaL_requiref(env -> L, "base", luaopen_base, 1);
  lua_pop(env -> L, 7);

  print_redirect_std(env -> L);

  lua_pushlightuserdata(env -> L, env -> tickrate);
  lua_pop(env -> L, 1);

  lua_register(env -> L, "request", l_http_request);
  lua_register(env -> L, "json_encode", lua_json_encode);
  lua_register(env -> L, "json_decode", lua_json_decode);
  lua_register(env -> L, "get_json_value", lua_get_json_value);

  lua_register(env -> L, "custom_log", lua_custom_log);

  log_info("Lua environment created");
  return env;
}

void lua_environment_destroy(LuaEnvironment * env) {
  if (env) {
    if (env -> L) {
      lua_close(env -> L);
      log_debug("Lua L closed");
    }
    free(env);
    log_info("Lua environment destroyed");
  }
}

void lua_register_core_functions(LuaEnvironment * env) {
  lua_register(env -> L, "reload_scripts", lua_reload_scripts);
  lua_register(env -> L, "send_response", lua_send_response);
  log_debug("Core Lua functions registered");
}
