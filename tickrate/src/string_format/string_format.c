#include <ctype.h>
#include <string.h>
#include <stdlib.h>

char * remove_extra_spaces(const char * str) {
  if (str == NULL) return NULL;

  size_t len = strlen(str);
  char * new_str = (char * ) malloc(len + 1);
  if (new_str == NULL) return NULL;

  const char * read = str;
  char * write = new_str;
  int space_found = 0;

  while ( * read != '\0') {
    if (!isspace((unsigned char) * read)) {
      * write++ = * read;
      space_found = 0;
    } else if (!space_found) {
      * write++ = ' ';
      space_found = 1;
    }
    read++;
  }

  if (write > new_str && isspace((unsigned char) * (write - 1))) {
    write--;
  }

  * write = '\0';
  return new_str;
}
