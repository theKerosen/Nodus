#include "src/logging/logging.h"
#include "src/tickrate/tickrate.h"
#include "src/socket/socket.h"
#include "src/commands/commands.h"
#include "util/lua/lua_init.h"
#include "src/socket/socket_pool.h"
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <signal.h>
#include <unistd.h>

pthread_mutex_t tickrate_mutex = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t tickrate_cond = PTHREAD_COND_INITIALIZER;
bool tickrate_initialized = false;

static volatile sig_atomic_t shutdown_requested = false;
static void handle_sigint(int sig) {
  (void) sig;
  shutdown_requested = true;
}

static void graceful_shutdown(Tickrate * tr, LuaEnvironment * lua_env,
  ThreadPool * tpool, pthread_t tick_th, pthread_t sock_th) {
  log_info("Initiating shutdown sequence");

  tickrate_stop(tr);
  thread_pool_shutdown(tpool);
  pthread_cond_broadcast( & tickrate_cond);

  int rc = pthread_join(tick_th, NULL);
  if (rc) log_error("Tickrate thread join failed: %s", strerror(rc));

  rc = pthread_join(sock_th, NULL);
  if (rc) log_error("Socket thread join failed: %s", strerror(rc));

  if (lua_env) lua_environment_destroy(lua_env);
  log_info("Resource cleanup complete");
}

int main() {
  signal(SIGINT, handle_sigint);
  set_log_level(LOG_LEVEL_INFO);

  Tickrate tr;
  if (!tickrate_init( & tr, 128.0)) return EXIT_FAILURE;

  LuaEnvironment * lua_env = lua_environment_create( & tr);
  if (!lua_env) return EXIT_FAILURE;

  lua_register_core_functions(lua_env);
  if (load_commands("commands", lua_env -> L) != 0) {
    log_error("Failed to load command scripts");
    return EXIT_FAILURE;
  }

  ClientPool cpool;
  client_pool_init( & cpool);

  ThreadPool tpool;
  thread_pool_init( & tpool);

  SocketHandler sock_handler;
  socket_handler_init( & sock_handler, & tr, & cpool, & tpool, lua_env);

  pthread_t tick_th, sock_th;
  if (pthread_create( & tick_th, NULL, tickrate_thread, & tr)) {
    log_error("Tickrate thread creation failed");
    return EXIT_FAILURE;
  }

  if (pthread_create( & sock_th, NULL, socket_listener, & sock_handler)) {
    log_error("Socket thread creation failed");
    tickrate_stop( & tr);
    pthread_join(tick_th, NULL);
    return EXIT_FAILURE;
  }

  while (!shutdown_requested) sleep(1);

  graceful_shutdown( & tr, lua_env, & tpool, tick_th, sock_th);
  return EXIT_SUCCESS;
}
