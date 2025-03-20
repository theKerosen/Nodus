#include "print_utils.h"
#include "../../src/logging/logging.h"
#include <string.h>
#include <lua.h>
#include <lualib.h>
#include <lauxlib.h>
#include <stdio.h>

static char print_buffer[PRINT_BUFFER_SIZE];
static size_t buffer_pos = 0;

static int lua_print(lua_State *L) {
    int nargs = lua_gettop(L);
    for (int i = 1; i <= nargs; i++) {
        const char *str = luaL_tolstring(L, i, NULL);
        if (str) {
            printf("%s", str);
            lua_pop(L, 1);
        }
        if (i < nargs) printf("\t");
    }
    printf("\n");
    return 0;
}

static int lua_print_buffer(lua_State *L) {
    int nargs = lua_gettop(L);
    for (int i = 1; i <= nargs; i++) {
        const char *str = luaL_tolstring(L, i, NULL);
        if (str) {
            size_t len = strlen(str);
            if (buffer_pos + len < PRINT_BUFFER_SIZE) {
                memcpy(print_buffer + buffer_pos, str, len);
                buffer_pos += len;
            }
            lua_pop(L, 1);
        }
        if (i < nargs && buffer_pos < PRINT_BUFFER_SIZE) {
            print_buffer[buffer_pos++] = '\t';
        }
    }
    if (buffer_pos < PRINT_BUFFER_SIZE) {
        print_buffer[buffer_pos++] = '\n';
    }
    return 0;
}

void print_redirect_std(lua_State *L) {
    lua_pushcfunction(L, lua_print);
    lua_setglobal(L, "print");
    log_debug("Redirected Lua print to stdout");
}

void print_redirect_buffer(lua_State *L) {
    lua_pushcfunction(L, lua_print_buffer);
    lua_setglobal(L, "print");
    log_debug("Redirected Lua print to buffer");
}

void print_buffer_clear(void) {
    memset(print_buffer, 0, PRINT_BUFFER_SIZE);
    buffer_pos = 0;
    log_debug("Cleared print buffer");
}

const char* print_buffer_get(void) {
    return print_buffer;
}

size_t print_buffer_length(void) {
    return buffer_pos;
}
