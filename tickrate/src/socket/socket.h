#ifndef SOCKET_H
#define SOCKET_H

#include "socket_pool.h"
#include "../../util/lua/lua_init.h"
#include "../tickrate/tickrate.h"
#include <arpa/inet.h>

#define PORT 27016
#define BACKLOG 3

typedef struct SocketHandler {
    int server_fd;
    struct sockaddr_in address;
    socklen_t addrlen;
    Tickrate *tickrate;
    ClientPool *client_pool;
    ThreadPool *thread_pool;
    LuaEnvironment *lua_env;
} SocketHandler;


void* handle_client(void *arg);
void socket_handler_init(SocketHandler *sh, Tickrate *tickrate,
                        ClientPool *client_pool, ThreadPool *thread_pool,
                        LuaEnvironment *lua_env);
void* socket_listener(void *arg);
void socket_handler_destroy(SocketHandler *sh);

#endif
