#ifndef JSON_H
#define JSON_H

#include <stdbool.h> // Include bool type
#include <stddef.h>

typedef struct JSONPair {
    char *key;
    char *value;
    bool is_nested;
    struct JSONPair *next;
} JSONPair;

typedef struct {
    JSONPair *head;
} JSONObject;

typedef struct {
    char *data;
    size_t capacity;
    size_t length;
} JsonBuffer;

JSONPair* create_json_pair(const char *key, const char *value, bool is_nested);
void add_json_pair(JSONObject *obj, const char *key, const char *value, bool is_nested);
char* json_encode(JSONObject *obj);
JSONObject* create_json_object();
void free_json_object(JSONObject *obj);
JSONObject* json_decode(const char *json_str);
JSONObject* get_json_object(JSONObject *obj, const char *key);
const char* get_json_value(JSONObject *obj, const char *key);
#endif // JSON_H
