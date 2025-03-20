#include "json.h"
#include "../logging/logging.h"
#include <ctype.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void json_buffer_init(JsonBuffer *buf, size_t initial_size) {
  buf->data = malloc(initial_size);
  buf->capacity = buf->data ? initial_size : 0;
  buf->length = 0;
  if (buf->data)
    buf->data[0] = '\0';
}

static bool json_buffer_append(JsonBuffer *buf, const char *data, size_t len) {
  if (buf->length + len + 1 > buf->capacity) {
    size_t new_cap = (buf->capacity * 2) > (buf->length + len + 1)
                         ? (buf->capacity * 2)
                         : (buf->length + len + 1);
    char *new_data = realloc(buf->data, new_cap);
    if (!new_data) {
      log_error("JSON buffer reallocation failed\n");
      return false;
    }
    buf->data = new_data;
    buf->capacity = new_cap;
  }
  memcpy(buf->data + buf->length, data, len);
  buf->length += len;
  buf->data[buf->length] = '\0';
  return true;
}

JSONPair *create_json_pair(const char *key, const char *value, bool is_nested) {
  if (!key || !value)
    return NULL;
  JSONPair *pair = malloc(sizeof(JSONPair));
  if (!pair)
    return NULL;
  pair->key = strdup(key);
  pair->value = strdup(value);
  pair->is_nested = is_nested;
  pair->next = NULL;
  if (!pair->key || !pair->value) {
    free(pair->key);
    free(pair->value);
    free(pair);
    return NULL;
  }
  return pair;
}

void add_json_pair(JSONObject *obj, const char *key, const char *value,
                   bool is_nested) {
  JSONPair *pair = create_json_pair(key, value, is_nested);
  if (!pair)
    return;
  pair->next = obj->head;
  obj->head = pair;
}

JSONObject *create_json_object() {
  JSONObject *obj = malloc(sizeof(JSONObject));
  if (obj)
    obj->head = NULL;
  return obj;
}

void free_json_object(JSONObject *obj) {
  if (!obj)
    return;
  JSONPair *pair = obj->head;
  while (pair) {
    JSONPair *next = pair->next;
    free(pair->key);
    free(pair->value);
    free(pair);
    pair = next;
  }
  free(obj);
}

JSONObject *get_json_object(JSONObject *obj, const char *key) {
  if (!obj || !key)
    return NULL;
  JSONPair *pair = obj->head;
  while (pair) {
    if (strcmp(pair->key, key) == 0 && pair->is_nested) {
      return json_decode(pair->value);
    }
    pair = pair->next;
  }
  return NULL;
}

const char *get_json_value(JSONObject *obj, const char *key) {
  if (!obj)
    return NULL;
  JSONPair *pair = obj->head;
  while (pair) {
    if (strcmp(pair->key, key) == 0) {
      return pair->value;
    }
    pair = pair->next;
  }
  return NULL;
}

char *json_encode(JSONObject *obj) {
  if (!obj || !obj->head)
    return strdup("{}");

  JsonBuffer buf;
  json_buffer_init(&buf, 1024);
  if (!buf.data)
    return NULL;

  if (!json_buffer_append(&buf, "{", 1)) {
    free(buf.data);
    return NULL;
  }

  JSONPair *pair = obj->head;
  while (pair) {

    if (!json_buffer_append(&buf, "\"", 1) ||
        !json_buffer_append(&buf, pair->key, strlen(pair->key)) ||
        !json_buffer_append(&buf, "\":", 2)) {
      free(buf.data);
      return NULL;
    }

    if (pair->is_nested) {
      if (!json_buffer_append(&buf, pair->value, strlen(pair->value))) {
        free(buf.data);
        return NULL;
      }
    } else if (strcmp(pair->value, "[[NULL]]") == 0) {
      if (!json_buffer_append(&buf, "null", 4)) {
        free(buf.data);
        return NULL;
      }
    } else {
      if (!json_buffer_append(&buf, "\"", 1)) {
        free(buf.data);
        return NULL;
      }
      const char *current = pair->value;
      while (*current) {

        const char *next_special = current;
        while (*next_special &&
               !((unsigned char)*next_special < 0x20 || *next_special == '"' ||
                 *next_special == '\\')) {
          next_special++;
        }

        if (next_special > current) {
          if (!json_buffer_append(&buf, current, next_special - current)) {
            free(buf.data);
            return NULL;
          }
        }

        if (*next_special) {
          char escape[2] = "\\";
          switch (*next_special) {
          case '"':
            escape[1] = '"';
            break;
          case '\\':
            escape[1] = '\\';
            break;
          case '\b':
            escape[1] = 'b';
            break;
          case '\f':
            escape[1] = 'f';
            break;
          case '\n':
            escape[1] = 'n';
            break;
          case '\r':
            escape[1] = 'r';
            break;
          case '\t':
            escape[1] = 't';
            break;
          default: {
            char hex[6];
            snprintf(hex, 6, "u%04x", (unsigned char)*next_special);
            if (!json_buffer_append(&buf, "\\", 1) ||
                !json_buffer_append(&buf, hex, 5)) {
              free(buf.data);
              return NULL;
            }
            current = next_special + 1;
            continue;
          }
          }
          if (!json_buffer_append(&buf, escape, 2)) {
            free(buf.data);
            return NULL;
          }
          current = next_special + 1;
        } else {
          current = next_special;
        }
      }
      if (!json_buffer_append(&buf, "\"", 1)) {
        free(buf.data);
        return NULL;
      }
    }

    if (pair->next && !json_buffer_append(&buf, ",", 1)) {
      free(buf.data);
      return NULL;
    }
    pair = pair->next;
  }

  if (!json_buffer_append(&buf, "}", 1)) {
    free(buf.data);
    return NULL;
  }
  return buf.data;
}

static char *parse_json_string(const char **ptr) {
  const char *start = *ptr;
  while (**ptr != '"' && **ptr) {
    if (**ptr == '\\')
      (*ptr)++;
    (*ptr)++;
  }
  if (**ptr != '"') {
    log_error("Unterminated string\n");
    return NULL;
  }
  (*ptr)++;

  size_t len = *ptr - start - 1;
  char *result = malloc(len + 1);
  if (!result)
    return NULL;

  const char *src = start;
  char *dest = result;
  while (src < *ptr - 1) {
    const char *next_escape = src;
    while (next_escape < *ptr - 1 && *next_escape != '\\')
      next_escape++;
    size_t chunk_len = next_escape - src;
    memcpy(dest, src, chunk_len);
    dest += chunk_len;
    src = next_escape;
    if (src < *ptr - 1) {
      src++;
      switch (*src) {
      case 'n':
        *dest++ = '\n';
        break;
      case 't':
        *dest++ = '\t';
        break;
      case 'r':
        *dest++ = '\r';
        break;
      case '"':
        *dest++ = '"';
        break;
      case '\\':
        *dest++ = '\\';
        break;
      default: {
        log_error("Invalid escape sequence: \\%c\n", *src);
        free(result);
        return NULL;
      }
      }
      src++;
    }
  }
  *dest = '\0';
  return result;
}

JSONObject *json_decode(const char *json_str) {
  if (!json_str || *json_str != '{')
    return NULL;

  JSONObject *obj = create_json_object();
  if (!obj)
    return NULL;

  const char *ptr = json_str + 1;
  while (*ptr && *ptr != '}') {
    while (isspace(*ptr))
      ptr++;
    if (*ptr != '"') {
      free_json_object(obj);
      return NULL;
    }
    ptr++;
    char *key = parse_json_string(&ptr);
    if (!key) {
      free_json_object(obj);
      return NULL;
    }
    while (isspace(*ptr) || *ptr == ':')
      ptr++;

    char *value = NULL;
    bool is_nested = false;
    if (*ptr == '"') {
      ptr++;
      value = parse_json_string(&ptr);
    } else if (*ptr == '{' || *ptr == '[') {
      is_nested = true;
      const char *start = ptr;
      int depth = 1;
      ptr++;
      while (depth > 0 && *ptr) {
        if (*ptr == '{' || *ptr == '[')
          depth++;
        else if (*ptr == '}' || *ptr == ']')
          depth--;
        ptr++;
      }
      value = strndup(start, ptr - start);
    } else if (strncmp(ptr, "null", 4) == 0) {
      value = strdup("[[NULL]]");
      ptr += 4;
    } else {
      free(key);
      free_json_object(obj);
      return NULL;
    }

    if (value) {
      add_json_pair(obj, key, value, is_nested);
      free(key);
      free(value);
    } else {
      free(key);
      free_json_object(obj);
      return NULL;
    }
    while (isspace(*ptr) || *ptr == ',')
      ptr++;
  }
  if (*ptr == '}')
    ptr++;
  return obj;
}
