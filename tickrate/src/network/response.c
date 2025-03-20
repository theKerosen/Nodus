#include "response.h"
#include "../logging/logging.h"
#include <unistd.h>
#include <string.h>
#include <sys/types.h>
#include <stdio.h>
#include <errno.h>

#define MESSAGE_DELIMITER '\x1e'
#define MAX_RESPONSE_SIZE 8192

void send_response(int client_fd,
  const char * response) {
  if (client_fd < 0 || !response) return;

  char full_message[MAX_RESPONSE_SIZE];
  int written = snprintf(full_message, sizeof(full_message),
    "%s%c", response, MESSAGE_DELIMITER);

  if (written < 0 || (size_t) written >= sizeof(full_message)) {
    log_error("Response truncation for client %d", client_fd);
    return;
  }

  size_t total_length = strlen(full_message);
  ssize_t bytes_sent = 0;

  while (bytes_sent < (ssize_t) total_length) {
    ssize_t result = write(client_fd, full_message + bytes_sent,
      total_length - bytes_sent);

    if (result <= 0) {
      if (errno == EAGAIN || errno == EWOULDBLOCK) {
        log_warn("Write blocked for client %d, retrying...", client_fd);
        usleep(10000);
        continue;
      }
      log_error("Failed to send response to client %d: %s",
        client_fd, strerror(errno));
      break;
    }

    bytes_sent += result;
  }

  if (bytes_sent == (ssize_t) total_length) {
    log_debug("Successfully sent %zd bytes to client %d", bytes_sent, client_fd);
  } else {
    log_error("Partial send to client %d (%zd/%zu bytes)",
      client_fd, bytes_sent, total_length);
  }
}
