#include "socket.h"
#include "../../src/json/json.h"
#include "../commands/commands.h"
#include "../logging/logging.h"
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define HEARTBEAT_INTERVAL 30
#define HEARTBEAT_TIMEOUT 60
#define MESSAGE_DELIMITER '\x1e'

char *unescape_lua_code(const char *input) {
  char *output = malloc(strlen(input) + 1);
  char *dest = output;

  while (*input) {
    if (*input == '\\') {
      switch (*(input + 1)) {
      case '\\':
        *dest++ = '\\';
        input += 2;
        break;
      case 'n':
        *dest++ = '\n';
        input += 2;
        break;
      case 't':
        *dest++ = '\t';
        input += 2;
        break;
      case '"':
        *dest++ = '"';
        input += 2;
        break;
      default:
        *dest++ = *input++;
        break;
      }
    } else {
      *dest++ = *input++;
    }
  }
  *dest = '\0';
  return output;
}

static void send_error_response(int socket, const char *message) {
  char response[512];
  snprintf(response, sizeof(response),
           "{\"type\":\"error\",\"data\":{\"message\":\"%s\"}}%c", message,
           MESSAGE_DELIMITER);
  send(socket, response, strlen(response), 0);
}

static void process_message(ClientData *client_data, const char *message) {
  JSONObject *root = json_decode(message);
  if (!root) {
    log_error("Failed to decode root JSON");
    send_error_response(client_data->socket, "Invalid JSON message");
    return;
  }

  const char *type = get_json_value(root, "type");
  const char *request_id = get_json_value(root, "id");
  if (!type || !request_id) {
    log_error("Missing 'type' or 'id' in message");
    send_error_response(client_data->socket, "Missing 'type' or 'id'");
    free_json_object(root);
    return;
  }

  if (strcmp(type, "command") == 0) {
    const char *data_str = get_json_value(root, "data");
    if (!data_str) {
      log_error("Missing 'data' in command message");
      send_error_response(client_data->socket, "Missing 'data'");
      free_json_object(root);
      return;
    }

    JSONObject *inner = json_decode(data_str);
    if (!inner) {
      log_error("Failed to decode inner JSON");
      send_error_response(client_data->socket, "Invalid inner JSON");
      free_json_object(root);
      return;
    }

    JSONObject *inner_data = get_json_object(inner, "data");
    if (!inner_data) {
      log_error("Missing 'data' object in inner JSON");
      send_error_response(client_data->socket, "Missing 'data' object");
      free_json_object(inner);
      free_json_object(root);
      return;
    }

    const char *command_name = get_json_value(inner_data, "name");
    if (!command_name) {
      log_error("Missing 'name' in command data");
      send_error_response(client_data->socket, "Missing 'name'");
      free_json_object(inner_data);
      free_json_object(inner);
      free_json_object(root);
      return;
    }

    JSONObject *args = get_json_object(inner_data, "args");
    if (!args) {
      log_error("Missing 'args' in command data");
      send_error_response(client_data->socket, "Missing 'args'");
      free_json_object(inner_data);
      free_json_object(inner);
      free_json_object(root);
      return;
    }

    const char *task_body = get_json_value(args, "task_body");
    char *clean_body = unescape_lua_code(task_body ? task_body : "");
    char *args_json = json_encode(args);
    if (!args_json || !clean_body) {
      log_error("Failed to encode args or unescape task_body");
      send_error_response(client_data->socket, "Failed to process args");
      free(clean_body);
      free(args_json);
      free_json_object(args);
      free_json_object(inner_data);
      free_json_object(inner);
      free_json_object(root);
      return;
    }

    log_debug("Executing command: %s", command_name);
    execute_command(command_name, clean_body, args_json, client_data->socket,
                    client_data->sh->lua_env->L, client_data->sh->tickrate,
                    request_id);

    free(clean_body);
    free(args_json);
    free_json_object(args);
    free_json_object(inner_data);
    free_json_object(inner);
  }

  free_json_object(root);
}

void *handle_client(void *arg) {
  ClientData *client_data = (ClientData *)arg;
  SocketHandler *sh = client_data->sh;
  char buffer[16384];
  time_t last_heartbeat_sent = time(NULL);
  time_t last_heartbeat_received = time(NULL);
  char *message_buffer = NULL;
  size_t buffer_size = 0;
  size_t capacity = 1024;

  message_buffer = malloc(capacity);
  if (!message_buffer) {
    log_error("Failed to allocate message buffer");
    close(client_data->socket);
    release_client(sh->client_pool, client_data);
    return NULL;
  }
  message_buffer[0] = '\0';

  while (sh->tickrate->is_running) {
    fd_set read_fds;
    struct timeval tv = {.tv_sec = 1, .tv_usec = 0};
    FD_ZERO(&read_fds);
    FD_SET(client_data->socket, &read_fds);

    int ready = select(client_data->socket + 1, &read_fds, NULL, NULL, &tv);
    if (ready < 0) {
      log_error("Select error: %s", strerror(errno));
      break;
    }

    if (ready > 0) {
      ssize_t bytes_read =
          read(client_data->socket, buffer, sizeof(buffer) - 1);
      if (bytes_read <= 0) {
        log_info("Client %d disconnected from socket", client_data->socket);
        break;
      }
      buffer[bytes_read] = '\0';
      log_debug("Received %zd bytes: %s", bytes_read, buffer);

      size_t new_size = buffer_size + bytes_read + 1;
      if (new_size > capacity) {
        while (capacity < new_size)
          capacity *= 2;
        char *new_buffer = realloc(message_buffer, capacity);
        if (!new_buffer) {
          log_error("Failed to realloc message buffer");
          break;
        }
        message_buffer = new_buffer;
      }
      memcpy(message_buffer + buffer_size, buffer, bytes_read);
      buffer_size += bytes_read;
      message_buffer[buffer_size] = '\0';

      char *msg = message_buffer;
      char *delimiter;
      while ((delimiter = strchr(msg, MESSAGE_DELIMITER)) != NULL) {
        *delimiter = '\0';
        if (strlen(msg) > 0) {
          log_debug("Processing message: %s", msg);
          process_message(client_data, msg);
          if (strstr(msg, "\"type\":\"heartbeat_response\"")) {
            last_heartbeat_received = time(NULL);
            log_debug("Updated heartbeat for client %d", client_data->socket);
          }
        }
        msg = delimiter + 1;
      }

      size_t remaining = buffer_size - (msg - message_buffer);
      if (remaining > 0) {
        memmove(message_buffer, msg, remaining);
      }
      buffer_size = remaining;
      if (buffer_size < capacity / 4 && capacity > 4096) {
        size_t new_capacity = buffer_size > 1024 ? buffer_size : 1024;
        char *new_buffer = realloc(message_buffer, new_capacity);
        if (new_buffer) {
          message_buffer = new_buffer;
          capacity = new_capacity;
        }
      }
      message_buffer[buffer_size] = '\0';
    }

    time_t now = time(NULL);
    if (now - last_heartbeat_sent >= 5) {
      char heartbeat[] = "{\"type\":\"heartbeat\",\"id\":\"server-hb\"}\x1e";
      send(client_data->socket, heartbeat, strlen(heartbeat), 0);
      log_debug("Sent heartbeat to client %d", client_data->socket);
      last_heartbeat_sent = now;
    }
    if (now - last_heartbeat_received > 30) {
      log_warn("Heartbeat timeout for client %d", client_data->socket);
      break;
    }
  }

  free(message_buffer);
  close(client_data->socket);
  release_client(sh->client_pool, client_data);
  return NULL;
}

void socket_handler_init(SocketHandler *sh, Tickrate *tickrate,
                         ClientPool *client_pool, ThreadPool *thread_pool,
                         LuaEnvironment *lua_env) {
  sh->tickrate = tickrate;
  sh->client_pool = client_pool;
  sh->thread_pool = thread_pool;
  sh->lua_env = lua_env;
  sh->addrlen = sizeof(sh->address);

  if ((sh->server_fd = socket(AF_INET, SOCK_STREAM, 0)) < 0) {
    log_error("Socket creation failed: %s", strerror(errno));
    exit(EXIT_FAILURE);
  }

  sh->address.sin_family = AF_INET;
  sh->address.sin_addr.s_addr = INADDR_ANY;
  sh->address.sin_port = htons(PORT);

  int yes = 1;
  if (setsockopt(sh->server_fd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes)) <
      0) {
    log_error("setsockopt(SO_REUSEADDR) failed: %s", strerror(errno));
    exit(EXIT_FAILURE);
  }

  if (bind(sh->server_fd, (struct sockaddr *)&sh->address, sh->addrlen) < 0) {
    log_error("Socket bind failed: %s", strerror(errno));
    close(sh->server_fd);
    exit(EXIT_FAILURE);
  }

  if (listen(sh->server_fd, BACKLOG) < 0) {
    log_error("Socket listen failed: %s", strerror(errno));
    close(sh->server_fd);
    exit(EXIT_FAILURE);
  }

  log_info("Socket server initialized on port %d", PORT);
}

void socket_handler_destroy(SocketHandler *sh) {
  if (sh->server_fd > 0) {
    close(sh->server_fd);
    log_info("Closed server socket");
  }
}

void *socket_listener(void *arg) {
  SocketHandler *sh = (SocketHandler *)arg;
  log_info("Socket is listening on port %d", PORT);

  while (sh->tickrate->is_running) {
    sh->addrlen = sizeof(sh->address);
    log_debug("Server on Standby.");

    int client_sock =
        accept(sh->server_fd, (struct sockaddr *)&sh->address, &sh->addrlen);
    if (client_sock < 0) {
      if (errno == EWOULDBLOCK || errno == EAGAIN) {
        usleep(100000);
        continue;
      } else if (errno == EINTR) {
        continue;
      }
      log_error("Accept failed: %s", strerror(errno));
      break;
    }

    int optval = 1;
    if (setsockopt(client_sock, SOL_SOCKET, SO_KEEPALIVE, &optval,
                   sizeof(optval)) < 0) {
      log_error("Failed to set SO_KEEPALIVE on client socket %d: %s",
                client_sock, strerror(errno));
      close(client_sock);
      continue;
    }

    int client_flags = fcntl(client_sock, F_GETFL, 0);
    fcntl(client_sock, F_SETFL, client_flags | O_NONBLOCK);

    ClientData *client = allocate_client(sh->client_pool);
    if (!client) {
      log_warn("Client pool full, rejecting connection");
      close(client_sock);
      continue;
    }

    *client = (ClientData){.socket = client_sock,
                           .sh = sh,
                           .buffer = {0},
                           .buffer_length = 0,
                           .last_heartbeat = time(NULL)};

    enqueue_client(sh->thread_pool, client);
    log_info("Client %d connected to socket", client_sock);
  }

  log_info("Socket listener stopped");
  return NULL;
}
