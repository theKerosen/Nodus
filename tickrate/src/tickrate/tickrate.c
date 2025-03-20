#include "tickrate.h"
#include "../logging/logging.h"
#include "../task/task_manager.h"
#include "sync.h"
#include <math.h>
#include <time.h>
#include <string.h>
#include <stdlib.h>

#define TICK_HISTORY_SIZE 10
#define NS_PER_SEC 1000000000L

static double timespec_to_seconds(const struct timespec *ts) {
    return (double)ts->tv_sec + (double)ts->tv_nsec / NS_PER_SEC;
}

static void calculate_metrics(Tickrate *tickrate, const struct timespec *start, const struct timespec *end) {
    double elapsed = timespec_to_seconds(end) - timespec_to_seconds(start);
    tickrate->elapsed_time = elapsed;

    if (elapsed > 0) {
        tickrate->current_rate = 1.0 / elapsed;
    } else {
        tickrate->current_rate = tickrate->target_rate;
        log_warn("Zero or negative elapsed time detected");
    }

    int index = tickrate->tick_count % TICK_HISTORY_SIZE;
    if (tickrate->tick_count >= TICK_HISTORY_SIZE) {
        tickrate->sum_tick_rates -= tickrate->tick_history[index];
    }
    tickrate->tick_history[index] = tickrate->current_rate;
    tickrate->sum_tick_rates += tickrate->current_rate;
    tickrate->tick_count++;

    int count = (tickrate->tick_count < TICK_HISTORY_SIZE) ? tickrate->tick_count : TICK_HISTORY_SIZE;
    tickrate->average_rate = tickrate->sum_tick_rates / count;
}

bool tickrate_init(Tickrate *tickrate, double target_hz) {
    if (target_hz <= 0 || isnan(target_hz)) {
        log_error("Invalid tickrate value: %.2f (must be > 0)", target_hz);
        exit(EXIT_FAILURE);
    }

    memset(tickrate, 0, sizeof(Tickrate));
    tickrate->target_rate = target_hz;
    tickrate->tick_interval = 1.0 / target_hz;
    tickrate->sum_tick_rates = 0.0;

    if (initialize_task_manager(&tickrate->task_manager) != 0) {
        log_error("Failed to initialize TaskManager");
        exit(EXIT_FAILURE);
    }

    log_debug("Initialized tickrate %.2f Hz with TaskManager: %p",
              target_hz, (void *)&tickrate->task_manager);

    tickrate->is_running = true;
    return true;
}

void tickrate_monitor(const Tickrate *tickrate) {
    log_info("Tick %lu: Real=%.2fHz, Avg=%.2fHz, Tasks=%zu",
             tickrate->tick_count,
             tickrate->current_rate,
             tickrate->average_rate,
             tickrate->task_manager.task_count);
}

static void precise_sleep(double interval) {
    struct timespec req = {
        .tv_sec = (time_t)interval,
        .tv_nsec = (long)((interval - (time_t)interval) * 1e9)
    };
    struct timespec rem;

    while (nanosleep(&req, &rem) != 0) {
        log_warn("Sleep interrupted, remaining: %ld.%09lds",
                 rem.tv_sec, rem.tv_nsec);
        req = rem;
    }
}

void *tickrate_thread(void *arg) {
    Tickrate *tickrate = (Tickrate *)arg;

    pthread_mutex_lock(&tickrate_mutex);
    pthread_cond_signal(&tickrate_cond);
    pthread_mutex_unlock(&tickrate_mutex);

    log_info("Starting tickrate thread (%.2f Hz)", tickrate->target_rate);

    struct timespec start, end;
    while (tickrate->is_running) {
        clock_gettime(CLOCK_MONOTONIC, &start);

        if (update_tasks(&tickrate->task_manager) != 0) {
            log_error("Task update failed");
        }

        if (process_task(&tickrate->task_manager) != 0) {
            log_error("Task processing failed");
        }

        clock_gettime(CLOCK_MONOTONIC, &end);
        calculate_metrics(tickrate, &start, &end);

        double tick_time = timespec_to_seconds(&end) - timespec_to_seconds(&start);
        double sleep_time = tickrate->tick_interval - tick_time;
        if (sleep_time > 0) {
            precise_sleep(sleep_time);
        } else {
            log_warn("Tick took longer than interval: %.6f seconds", -sleep_time);
        }
    }

    log_info("Stopping tickrate thread");
    return NULL;
}

bool tickrate_is_running(const Tickrate *tr) {
    return tr->is_running;
}

void tickrate_stop(Tickrate *tr) {
    tr->is_running = false;
}
