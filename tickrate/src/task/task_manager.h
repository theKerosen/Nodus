#ifndef TASK_MANAGER_H
#define TASK_MANAGER_H

#include "task.h"

int initialize_task_manager(TaskManager *tm);
void destroy_task_manager(TaskManager *tm);
int update_tasks(TaskManager *tm);
int process_task(TaskManager *tm);

#endif
