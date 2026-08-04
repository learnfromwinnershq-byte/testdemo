FROM nginx:1.27-alpine

RUN rm -rf /usr/share/nginx/html/*

COPY index.html /usr/share/nginx/html/index.html
COPY games /usr/share/nginx/html/games
COPY learn /usr/share/nginx/html/learn
COPY songs /usr/share/nginx/html/songs
COPY codex-push-test.txt /usr/share/nginx/html/codex-push-test.txt

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
