# Dockerfile
FROM node:20-alpine

# 非rootユーザ（/sbin/nologin 相当）
RUN addgroup -S ctfsvc && adduser -S ctfsvc -G ctfsvc -s /sbin/nologin

WORKDIR /app
COPY server.js /app/
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && chown -R ctfsvc:ctfsvc /app

USER ctfsvc
ENV NODE_ENV=production
ENV PORT=8000
EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
