#include "logging.h"
#include <pthread.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include <time.h>

#define ANSI_RESET "\x1b[0m"
#define ANSI_GRAY "\x1b[90m"
#define ANSI_GREEN "\x1b[32m"
#define ANSI_YELLOW "\x1b[33m"
#define ANSI_RED "\x1b[31m"

#define MAX_MESSAGE_LEN 1024
#define HISTORY_SIZE 2
static struct {
  char messages[HISTORY_SIZE][MAX_MESSAGE_LEN];
  int count;
  int suppressed;
  int suppressed_count;
} log_history = {.count = 0, .suppressed = 0, .suppressed_count = 0};

static LogLevel current_log_level = LOG_LEVEL_INFO;

void set_log_level(LogLevel level) { current_log_level = level; }

static void shift_history() {
  for (int i = 0; i < HISTORY_SIZE - 1; i++) {
    strncpy(log_history.messages[i], log_history.messages[i + 1],
            MAX_MESSAGE_LEN);
    log_history.messages[i][MAX_MESSAGE_LEN - 1] = '\0';
  }
}

static void update_history(const char *message) {
  if (log_history.count < HISTORY_SIZE) {
    strncpy(log_history.messages[log_history.count++], message,
            MAX_MESSAGE_LEN);
    log_history.messages[log_history.count - 1][MAX_MESSAGE_LEN - 1] = '\0';
  } else {
    shift_history();
    strncpy(log_history.messages[HISTORY_SIZE - 1], message, MAX_MESSAGE_LEN);
    log_history.messages[HISTORY_SIZE - 1][MAX_MESSAGE_LEN - 1] = '\0';
  }
}

static int is_duplicate(const char *message) {
  if (log_history.count < HISTORY_SIZE)
    return 0;
  for (int i = 0; i < HISTORY_SIZE; i++) {
    if (strcmp(log_history.messages[i], message) != 0)
      return 0;
  }
  return 1;
}

static void log_suppression_message() {
  time_t now;
  struct tm *timeinfo;
  char timestamp[20];
  time(&now);
  timeinfo = localtime(&now);
  strftime(timestamp, sizeof(timestamp), "%Y-%m-%d %H:%M:%S", timeinfo);

  fprintf(
      stderr,
      "[%s] %s[INFO]%s Duplication detected, suppressing further messages%s",
      timestamp, ANSI_GREEN, ANSI_RESET, ANSI_RESET);
}

static void log_message(LogLevel level, const char *format, va_list args) {
  if (level < current_log_level)
    return;

  char message_buffer[MAX_MESSAGE_LEN];
  vsnprintf(message_buffer, MAX_MESSAGE_LEN, format, args);
  message_buffer[MAX_MESSAGE_LEN - 1] = '\0';

  if (is_duplicate(message_buffer)) {
    if (!log_history.suppressed) {
      log_suppression_message();
      log_history.suppressed = 1;
    }
    log_history.suppressed_count++;
    return;
  }

  update_history(message_buffer);

  time_t now;
  struct tm *timeinfo;
  char timestamp[20];
  time(&now);
  timeinfo = localtime(&now);
  strftime(timestamp, sizeof(timestamp), "%Y-%m-%d %H:%M:%S", timeinfo);

  fprintf(stderr, "[%s] %s[INFO]%s %s%s\n", timestamp, ANSI_GREEN, ANSI_RESET,
          message_buffer, ANSI_RESET);
}

void log_debug(const char *format, ...) {
  va_list args;
  va_start(args, format);
  log_message(LOG_LEVEL_DEBUG, format, args);
  va_end(args);
}

void log_info(const char *format, ...) {
  va_list args;
  va_start(args, format);
  log_message(LOG_LEVEL_INFO, format, args);
  va_end(args);
}

void log_warn(const char *format, ...) {
  va_list args;
  va_start(args, format);
  log_message(LOG_LEVEL_WARN, format, args);
  va_end(args);
}

void log_error(const char *format, ...) {
  va_list args;
  va_start(args, format);
  log_message(LOG_LEVEL_ERROR, format, args);
  va_end(args);
}
