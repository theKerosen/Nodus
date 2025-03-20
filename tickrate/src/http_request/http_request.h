#ifndef HTTP_REQUEST_H
#define HTTP_REQUEST_H

#include <curl/curl.h>

struct curl_slist;

char *http_request(const char *method, const char *url, const char *data, struct curl_slist *headers);

#endif // HTTP_REQUEST_H
