FROM node:20-alpine

WORKDIR /app
COPY backend/package.json backend/package-lock.json backend/
RUN npm ci --omit=dev --prefix backend
COPY backend/*.js backend/
# Read-only D&D 2014 data snapshot (see backend/tools/warm-dnd-cache.js)
COPY backend/seed backend/seed
COPY public ./public

ENV NODE_OPTIONS=--max-old-space-size=192
EXPOSE 3000
CMD ["node", "backend/server.js"]
