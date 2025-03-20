#ifndef TICKRATE_H
#define TICKRATE_H

#include "../task/task.h"
#include <stdbool.h>
#include <time.h>

typedef struct Tickrate {
    double target_rate;
    double current_rate;
    double sum_tick_rates;
    double average_rate;
    double tick_interval;
    size_t tick_count;
    double tick_history[10];
    double elapsed_time;
    bool is_running;
    TaskManager task_manager;
} Tickrate;


bool tickrate_init(Tickrate* tr, double target_hz);
bool tickrate_is_running(const Tickrate* tr);
void tickrate_stop(Tickrate* tr);
void* tickrate_thread(void* arg);


void tickrate_monitor(const Tickrate* tr);
double tickrate_get_average(const Tickrate* tr);
double tickrate_get_current(const Tickrate* tr);


void* tickrate_thread(void* arg);

#endif
