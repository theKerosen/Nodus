#ifndef SYNC_H
#define SYNC_H

#include <pthread.h>
#include <stdbool.h>

extern pthread_mutex_t tickrate_mutex;
extern pthread_cond_t tickrate_cond;
extern bool tickrate_initialized;

#endif