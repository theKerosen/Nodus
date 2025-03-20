#include "commands.h"
#include "../socket/socket.h"
#include "../logging/logging.h"
#include "../json/json.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <dirent.h>
#include <limits.h>
#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>
#include <sys/stat.h>

#define MESSAGE_DELIMITER '\x1e'

static int lua_add_task_fallback(lua_State *L) {
  const char *error_msg = "add_task not properly registered!";
  lua_pushstring(L, error_msg);
  return lua_error(L);
}

int load_commands(const char *directory, lua_State *L) {
  char resolved_path[PATH_MAX * 2];
  const char *priority_scripts[] = {"add_task.lua"};

  luaL_openlibs(L);

  for (size_t i = 0; i < sizeof(priority_scripts) / sizeof(priority_scripts[0]);
       i++) {
    char fullpath[PATH_MAX];
    struct stat path_stat;

    int written = snprintf(fullpath, sizeof(fullpath), "%s/%s", directory,
                           priority_scripts[i]);
    if (written < 0 || (size_t)written >= sizeof(fullpath)) {
      log_warn("Priority script path truncated: %s", priority_scripts[i]);
      continue;
    }

    if (stat(fullpath, &path_stat) != 0) {
      log_warn("Priority script not found: %s", fullpath);
      continue;
    }

    log_info("Loading priority script %s", fullpath);
    int load_status = luaL_loadfile(L, fullpath);
    if (load_status != LUA_OK) {
      log_error("Failed to load priority script %s: %s", fullpath,
                lua_tostring(L, -1));
      lua_pop(L, 1);
      continue;
    }

    int exec_status = lua_pcall(L, 0, 0, 0);
    if (exec_status != LUA_OK) {
      log_error("Failed to execute priority script %s: %s", fullpath,
                lua_tostring(L, -1));
      lua_pop(L, 1);
      continue;
    }

    lua_getglobal(L, "add_task");
    if (!lua_isfunction(L, -1)) {
      log_error("Critical: add_task not registered by %s!", fullpath);
      lua_pushcfunction(L, lua_add_task_fallback);
      lua_setglobal(L, "add_task");
    }
    lua_pop(L, 1);
  }

  if (realpath(directory, resolved_path) == NULL) {
    log_error("Invalid command directory: %s", directory);
    return 1;
  }

  DIR *dp = opendir(resolved_path);
  if (!dp) {
    log_error("Failed to open command directory: %s", resolved_path);
    return 1;
  }

  struct dirent *entry;
  while ((entry = readdir(dp)) != NULL) {

    const char *dot = strrchr(entry->d_name, '.');
    if (!dot || strcmp(dot, ".lua") != 0) {
      continue;
    }

    int is_priority = 0;
    for (size_t i = 0;
         i < sizeof(priority_scripts) / sizeof(priority_scripts[0]); i++) {
      if (strcmp(entry->d_name, priority_scripts[i]) == 0) {
        is_priority = 1;
        break;
      }
    }
    if (is_priority)
      continue;

    char fullpath[PATH_MAX * 2];
    int written = snprintf(fullpath, sizeof(fullpath), "%s/%s", resolved_path,
                           entry->d_name);
    if (written < 0 || (size_t)written >= sizeof(fullpath)) {
      log_warn("Path truncated for: %s/%s", resolved_path, entry->d_name);
      continue;
    }

    struct stat path_stat;
    if (stat(fullpath, &path_stat) != 0 || !S_ISREG(path_stat.st_mode)) {
      continue;
    }

    size_t name_len = dot - entry->d_name;
    char command_name[256] = {0};
    if (name_len >= sizeof(command_name)) {
      log_warn("Command name too long in %s", entry->d_name);
      continue;
    }
    strncpy(command_name, entry->d_name, name_len);
    command_name[name_len] = '\0';

    log_info("Loading command script: %s", fullpath);

    if (luaL_loadfile(L, fullpath) != LUA_OK ||
        lua_pcall(L, 0, 0, 0) != LUA_OK) {
      log_error("Failed to load script %s: %s", fullpath, lua_tostring(L, -1));
      lua_pop(L, 1);
      continue;
    }

    lua_getglobal(L, command_name);
    if (!lua_isfunction(L, -1)) {
      log_warn("Script %s didn't register function %s", entry->d_name,
               command_name);
    }
    lua_pop(L, 1);

    log_debug("Successfully loaded script: %s", fullpath);
  }

  closedir(dp);
  return 0;
}

static void lua_push_json_table(lua_State *L, JSONObject *obj) {
  if (!obj) {
    lua_pushnil(L);
    return;
  }

  if (!lua_checkstack(L, 3)) {
    log_error("Lua stack overflow in lua_push_json_table");
    lua_pushnil(L);
    return;
  }

  lua_newtable(L);
  JSONPair *pair = obj->head;
  static int recursion_depth = 0;
  const int MAX_RECURSION = 20;

  while (pair) {
    if (recursion_depth++ > MAX_RECURSION) {
      log_error(
          "Max recursion depth exceeded in lua_push_json_table for key: %s",
          pair->key);
      recursion_depth--;
      break;
    }

    if (!pair->key) {
      log_error("NULL key encountered in JSONPair");
      pair = pair->next;
      recursion_depth--;
      continue;
    }

    lua_pushstring(L, pair->key);

    if (pair->is_nested && recursion_depth == 1) {
      if (!pair->value) {
        log_error("NULL nested value for key: %s", pair->key);
        lua_pushnil(L);
      } else {
        JSONObject *nested = json_decode(pair->value);
        if (nested) {
          lua_push_json_table(L, nested);
          free_json_object(nested);
        } else {
          log_error("Failed to decode nested JSON for key: %s, value: %s",
                    pair->key, pair->value);
          lua_pushstring(L, pair->value);
        }
      }
    } else {

      if (!pair->value) {
        log_error("NULL value for key: %s", pair->key);
        lua_pushnil(L);
      } else if (strcmp(pair->value, "[[NULL]]") == 0) {
        lua_pushnil(L);
      } else {
        lua_pushstring(L, pair->value);
      }
    }

    lua_settable(L, -3);
    pair = pair->next;
    recursion_depth--;
  }

  recursion_depth = 0;
}

void execute_command(const char *command, char *cleaned, const char *args_json,
                     int socket, lua_State *L, Tickrate *tickrate,
                     const char *request_id) {
  (void)tickrate;
  (void)cleaned;

  lua_getglobal(L, command);
  if (!lua_isfunction(L, -1)) {
    log_error("Command %s not registered", command);
    lua_pop(L, 1);
    char response[512];
    snprintf(response, sizeof(response),
             "{\"id\":\"%s\",\"type\":\"error\",\"data\":{\"message\":"
             "\"Command '%s' not found\"}}%c",
             request_id, command, MESSAGE_DELIMITER);
    send(socket, response, strlen(response), 0);
    return;
  }

  JSONObject *args_obj = json_decode(args_json);
  if (!args_obj) {
    log_error("Failed to decode args_json: %s", args_json);
    lua_pop(L, 1);
    char response[512];
    snprintf(response, sizeof(response),
             "{\"id\":\"%s\",\"type\":\"error\",\"data\":{\"message\":"
             "\"Invalid args format\"}}%c",
             request_id, MESSAGE_DELIMITER);
    send(socket, response, strlen(response), 0);
    return;
  }

  log_debug("Pushing args_json to Lua: %s", args_json);
  lua_push_json_table(L, args_obj);
  lua_pushinteger(L, socket);
  lua_pushstring(L, request_id);

  if (lua_pcall(L, 3, 1, 0) != LUA_OK) {
    const char *err_msg = lua_tostring(L, -1);
    log_error("Lua error in %s: %s", command, err_msg);
    char response[1024];
    snprintf(response, sizeof(response),
             "{\"id\":\"%s\",\"type\":\"error\",\"data\":{\"message\":\"Lua "
             "error: %s\"}}%c",
             request_id, err_msg, MESSAGE_DELIMITER);
    send(socket, response, strlen(response), 0);
    lua_pop(L, 1);
  } else {
    if (lua_isstring(L, -1)) {
      const char *response = lua_tostring(L, -1);
      char *delimited_response = malloc(strlen(response) + 2);
      sprintf(delimited_response, "%s%c", response, MESSAGE_DELIMITER);
      send(socket, delimited_response, strlen(delimited_response), 0);
      free(delimited_response);
    } else {
      log_warn("Non-string result from %s, type: %s", command,
               lua_typename(L, lua_type(L, -1)));
      lua_getglobal(L, "json_encode");
      if (lua_isfunction(L, -1)) {
        lua_pushvalue(L, -2);
        if (lua_pcall(L, 1, 1, 0) == LUA_OK && lua_isstring(L, -1)) {
          const char *response = lua_tostring(L, -1);
          log_debug("Encoded response for %s: %s", request_id, response);

          char *delimited_response = malloc(strlen(response) + 2);
          sprintf(delimited_response, "%s%c", response, MESSAGE_DELIMITER);
          send(socket, delimited_response, strlen(delimited_response), 0);
          free(delimited_response);
        } else {
          const char *encode_err = lua_tostring(L, -1);
          log_error("Failed to encode result for %s: %s", command,
                    encode_err ? encode_err : "Unknown error");
          char response[512];
          snprintf(response, sizeof(response),
                   "{\"id\":\"%s\",\"type\":\"error\",\"data\":{\"message\":"
                   "\"Failed to encode result\"}}%c",
                   request_id, MESSAGE_DELIMITER);
          send(socket, response, strlen(response), 0);
        }
      } else {
        log_error("json_encode not available for %s", command);
        char response[512];
        snprintf(response, sizeof(response),
                 "{\"id\":\"%s\",\"type\":\"error\",\"data\":{\"message\":"
                 "\"json_encode not available\"}}%c",
                 request_id, MESSAGE_DELIMITER);
        send(socket, response, strlen(response), 0);
      }
    }
    lua_pop(L, 1);
  }

  free_json_object(args_obj);
}
