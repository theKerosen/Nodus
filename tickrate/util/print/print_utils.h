#ifndef PRINT_UTILS_H
#define PRINT_UTILS_H

#include <lua.h>
#include <stddef.h>

#define PRINT_BUFFER_SIZE 4096

void print_redirect_std(lua_State *L);
void print_redirect_buffer(lua_State *L);
void print_buffer_clear(void);
const char* print_buffer_get(void);
size_t print_buffer_length(void);

#endif