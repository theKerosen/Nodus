#include "http_lua.h"
#include "../../src/logging/logging.h"
#include "../../src/http_request/http_request.h"
#include <curl/curl.h>
#include <stdlib.h>

int l_http_request(lua_State * L) {
  const char * method = luaL_checkstring(L, 1);
  const char * url = luaL_checkstring(L, 2);
  const char * data = luaL_optstring(L, 3, NULL);

  log_info("%s -> %s", method, url);

  struct curl_slist * headers = NULL;
  if (lua_istable(L, 4)) {
    lua_pushnil(L);
    while (lua_next(L, 4) != 0) {
      const char * header = luaL_checkstring(L, -1);
      headers = curl_slist_append(headers, header);
      lua_pop(L, 1);
    }
  }

  char * response = http_request(method, url, data, headers);
  curl_slist_free_all(headers);

  if (!response) {
    lua_pushnil(L);
    lua_pushstring(L, "HTTP request failed");
    return 2;
  }

  lua_pushstring(L, response);
  free(response);
  return 1;
}
