#ifndef TASK_H
#define TASK_H

#include <pthread.h>


typedef struct Task {
    int id;
    char name[256];
    void (*task_function)(void);
    struct Task *next;
    pthread_mutex_t lock;
} Task;

typedef struct TaskManager {
    Task *tasks;
    Task *new_tasks;
    Task *scheduled_tasks;
    size_t task_count;
    size_t tasks_processed;
    pthread_mutex_t lock;
    pthread_cond_t task_available;
} TaskManager;

#endif
