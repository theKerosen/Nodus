# Compiler and Flags
CC = gcc
# Add these flags to enable POSIX features
CFLAGS = -Wall -Wextra -Werror -pedantic -pthread -std=c11 -fsanitize=address
CFLAGS += -D_DEFAULT_SOURCE
CFLAGS += -D_POSIX_C_SOURCE=200112L  # Enable POSIX 2001.1-2001 features
CFLAGS += -I./src -I./util -I./src/task -I./util/logging
CFLAGS += -I./util/lua -I./util/http -I./util/json
CFLAGS += -I/usr/include/lua5.4
LDFLAGS = -lpthread -lcurl -llua5.4 -lm

# Directory Structure
SRCDIR = src
UTILDIR = util
BUILDDIR = build
TARGETDIR = bin
TARGET = $(TARGETDIR)/tick_server

# Explicit Source List to ensure order
SRCS = \
    $(SRCDIR)/task/task_manager.c \
    $(SRCDIR)/tickrate/tickrate.c \
    $(SRCDIR)/logging/logging.c \
    $(SRCDIR)/string_format/string_format.c \
    $(SRCDIR)/socket/socket_pool.c \
    $(SRCDIR)/socket/socket.c \
    $(SRCDIR)/http_request/http_request.c \
    $(SRCDIR)/commands/commands.c \
    $(SRCDIR)/json/json.c \
    $(SRCDIR)/network/response.c \
    $(UTILDIR)/http/http_lua.c \
    $(UTILDIR)/lua/lua_init.c \
    $(UTILDIR)/print/print_utils.c \
    $(UTILDIR)/commands/commands_lua.c \
    $(UTILDIR)/json/json_lua.c \
    main.c

# Object Files
OBJS = $(patsubst %.c, $(BUILDDIR)/%.o, $(SRCS))

# Ensure build directories exist
$(shell mkdir -p $(sort $(dir $(OBJS))) $(TARGETDIR))

# Build Rules
$(TARGET): $(OBJS)
	$(CC) $(CFLAGS) $^ -o $@ $(LDFLAGS)

$(BUILDDIR)/%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

# Phony Targets
.PHONY: clean debug release

clean:
	rm -rf $(BUILDDIR) $(TARGETDIR)

debug: CFLAGS += -g -DDEBUG
debug: $(TARGET)

release: CFLAGS += -O3
release: $(TARGET)
