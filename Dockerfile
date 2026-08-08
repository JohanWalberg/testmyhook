FROM node:26-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production \
    PORT=8787 \
    DB_PATH=/data/testmyhook.db

VOLUME /data
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:8787/healthz || exit 1

CMD ["npm", "start"]
