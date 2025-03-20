#include <curl/curl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../logging/logging.h"

struct memory {
    char *response;
    size_t size;
};

static size_t write_callback(void *data, size_t size, size_t nmemb, void *userp) {
    size_t realsize = size * nmemb;
    struct memory *mem = (struct memory *)userp;

    char *ptr = realloc(mem->response, mem->size + realsize + 1);
    if (ptr == NULL) {
        log_error("Failed to allocate memory for response");
        return 0;
    }

    mem->response = ptr;
    memcpy(&(mem->response[mem->size]), data, realsize);
    mem->size += realsize;
    mem->response[mem->size] = 0;

    return realsize;
}

char *http_request(const char *method, const char *url, const char *data, struct curl_slist *headers) {
    CURL *curl;
    CURLcode res;
    struct memory chunk = {0};


    curl = curl_easy_init();
    if (!curl) {
        fprintf(stderr, "Failed to initialize CURL\n");
        return strdup("Failed to initialize CURL");
    }


    curl_easy_setopt(curl, CURLOPT_URL, url);
    curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, method);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&chunk);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 10L);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);


    if (headers) {
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    }


    if (data && (strcmp(method, "POST") == 0 || strcmp(method, "PUT") == 0 ||
                 strcmp(method, "PATCH") == 0 || strcmp(method, "DELETE") == 0)) {
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, data);
    }


    res = curl_easy_perform(curl);
    if (res != CURLE_OK) {
        const char *error_message = curl_easy_strerror(res);
        fprintf(stderr, "curl_easy_perform() failed: %s\n", error_message);
        free(chunk.response);
        curl_easy_cleanup(curl);
        return strdup(error_message);
    }


    curl_easy_cleanup(curl);


    return chunk.response;
}
