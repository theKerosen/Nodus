#include "task_manager.h"
#include "../logging/logging.h"
#include <stdlib.h>
#include <pthread.h>
#include <string.h>
#include <unistd.h>

int initialize_task_manager(TaskManager * tm) {
  if (!tm) return -1;
  tm -> tasks = tm -> new_tasks = tm -> scheduled_tasks = NULL;
  tm -> task_count = tm -> tasks_processed = 0;

  if (pthread_mutex_init( & tm -> lock, NULL) != 0) {
    log_error("Mutex init failed");
    return -1;
  }

  if (pthread_cond_init( & tm -> task_available, NULL) != 0) {
    pthread_mutex_destroy( & tm -> lock);
    log_error("Condition variable initialization failed");
    return -1;
  }

  return 0;
}

void destroy_task_manager(TaskManager * tm) {
  if (!tm) return;
  pthread_mutex_destroy( & tm -> lock);
  pthread_cond_destroy( & tm -> task_available);
  log_info("Destroyed TaskManager");
}

int update_tasks(TaskManager * tm) {
  if (!tm) return -1;

  pthread_mutex_lock( & tm -> lock);
  size_t initial_count = tm -> task_count;

  Task * current = tm -> new_tasks;
  while (current) {
    Task * next = current -> next;
    current -> next = tm -> tasks;
    tm -> tasks = current;
    tm -> task_count++;
    current = next;
  }

  tm -> new_tasks = NULL;
  size_t added = tm -> task_count - initial_count;
  pthread_mutex_unlock( & tm -> lock);

  if (added > 0) {
    log_debug("Added %zu new tasks", added);
  }

  return 0;
}

int process_task(TaskManager * tm) {
  if (!tm) return -1;

  pthread_mutex_lock( & tm -> lock);

  while (tm -> task_count == 0) {
    pthread_cond_wait( & tm -> task_available, & tm -> lock);
  }

  Task * task = tm -> tasks;
  if (task) {
    tm -> tasks = task -> next;
    tm -> task_count--;
  }

  pthread_mutex_unlock( & tm -> lock);

  if (task && task -> task_function) {
    task -> task_function();
    free(task);
    tm -> tasks_processed++;
    log_info("Processed task (total: %zu)", tm -> tasks_processed);
  }

  return 0;
}
