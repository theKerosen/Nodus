#ifndef SOCKET_POOL_H
#define SOCKET_POOL_H

#include <netinet/in.h>
#include <pthread.h>
#include <stdbool.h>
#include <sys/socket.h>

struct SocketHandler;
typedef struct Tickrate Tickrate;
typedef struct LuaEnvironment LuaEnvironment;

#define BUFFER_SIZE 16384
#define MAX_CLIENTS 32
#define THREAD_POOL_SIZE 8
#define QUEUE_CAPACITY 64

typedef struct {
  int socket;
  char buffer[BUFFER_SIZE];
  size_t buffer_length;
  struct SocketHandler *sh;
  time_t last_heartbeat;
} ClientData;

typedef struct {
  ClientData clients[MAX_CLIENTS];
  int available[MAX_CLIENTS];
  int available_indices[MAX_CLIENTS];
  int available_count;
  pthread_mutex_t lock;
} ClientPool;

typedef struct {
  pthread_t threads[THREAD_POOL_SIZE];
  pthread_mutex_t queue_lock;
  pthread_cond_t queue_cond;
  ClientData *queue[QUEUE_CAPACITY];
  size_t queue_size;
  bool running;
} ThreadPool;

void client_pool_init(ClientPool *pool);
ClientData *allocate_client(ClientPool *pool);
void release_client(ClientPool *pool, ClientData *client);

void thread_pool_init(ThreadPool *pool);
void thread_pool_shutdown(ThreadPool *pool);
void enqueue_client(ThreadPool *pool, ClientData *client);

#endif
