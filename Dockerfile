FROM node:24-bookworm-slim
WORKDIR /app
COPY production.mjs email-auth.mjs mail.mjs ./
COPY dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
ENV NODE_ENV=production PORT=4318 DATA_DIR=/data
EXPOSE 4318
VOLUME ["/data"]
CMD ["node", "production.mjs"]
