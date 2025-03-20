#include "socket_pool.h"
#include "../logging/logging.h"
#include "socket.h"
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

void client_pool_init(ClientPool *pool) {
    memset(pool, 0, sizeof(ClientPool));
    for (int i = 0; i < MAX_CLIENTS; i++) {
        pool->available[i] = 1;
        pool->available_indices[i] = i;
    }
    pool->available_count = MAX_CLIENTS;
    pthread_mutex_init(&pool->lock, NULL);
    log_debug("Initialized client pool with %d slots", MAX_CLIENTS);
}

ClientData *allocate_client(ClientPool *pool) {
    pthread_mutex_lock(&pool->lock);
    ClientData *client = NULL;
    if (pool->available_count > 0) {
        int index = pool->available_indices[--pool->available_count];
        client = &pool->clients[index];
        pool->available[index] = 0;
    }
    pthread_mutex_unlock(&pool->lock);
    if (!client) {
        log_warn("No available client slots");
    }
    return client;
}

void release_client(ClientPool *pool, ClientData *client) {
    pthread_mutex_lock(&pool->lock);
    int index = client - pool->clients;
    if (index >= 0 && index < MAX_CLIENTS) {
        pool->available[index] = 1;
        pool->available_indices[pool->available_count++] = index;
        log_debug("Released client slot %d", index);
    }
    pthread_mutex_unlock(&pool->lock);
}

static void *thread_worker(void *arg) {
    ThreadPool *pool = (ThreadPool *)arg;
    while (1) {
        pthread_mutex_lock(&pool->queue_lock);
        while (pool->queue_size == 0 && pool->running) {
            pthread_cond_wait(&pool->queue_cond, &pool->queue_lock);
        }
        if (!pool->running && pool->queue_size == 0) {
            pthread_mutex_unlock(&pool->queue_lock);
            break;
        }
        if (pool->queue_size > 0) {
            ClientData *client = pool->queue[--pool->queue_size];
            pthread_mutex_unlock(&pool->queue_lock);
            if (client) {
                log_info("Pool worker picked up client %d", client->socket);
                handle_client(client);
            }
        } else {
            pthread_mutex_unlock(&pool->queue_lock);
        }
    }
    return NULL;
}

void thread_pool_init(ThreadPool *pool) {
    memset(pool, 0, sizeof(ThreadPool));
    pool->running = true;
    pthread_mutex_init(&pool->queue_lock, NULL);
    pthread_cond_init(&pool->queue_cond, NULL);
    for (int i = 0; i < THREAD_POOL_SIZE; i++) {
        pthread_create(&pool->threads[i], NULL, thread_worker, pool);
    }
    log_info("Initialized thread pool with %d workers", THREAD_POOL_SIZE);
}

void thread_pool_shutdown(ThreadPool *pool) {
    pthread_mutex_lock(&pool->queue_lock);
    pool->running = false;
    pthread_cond_broadcast(&pool->queue_cond);
    pthread_mutex_unlock(&pool->queue_lock);
    for (int i = 0; i < THREAD_POOL_SIZE; i++) {
        pthread_join(pool->threads[i], NULL);
    }
    pthread_mutex_destroy(&pool->queue_lock);
    pthread_cond_destroy(&pool->queue_cond);
    log_info("Thread pool shutdown complete");
}

void enqueue_client(ThreadPool *pool, ClientData *client) {
    pthread_mutex_lock(&pool->queue_lock);
    if (pool->queue_size < QUEUE_CAPACITY) {
        pool->queue[pool->queue_size++] = client;
        pthread_cond_signal(&pool->queue_cond);
        log_debug("Enqueued client %d (queue size: %zu)", client->socket, pool->queue_size);
    } else {
        log_warn("Task queue full, rejecting client %d", client->socket);
        release_client(client->sh->client_pool, client);
        close(client->socket);
    }
    pthread_mutex_unlock(&pool->queue_lock);
}
