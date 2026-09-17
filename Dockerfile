FROM node:20-alpine

WORKDIR /app
COPY backend/package.json backend/
RUN npm install --omit=dev --prefix backend
COPY backend/server.js backend/
COPY public ./public

ENV NODE_OPTIONS=--max-old-space-size=192
EXPOSE 3000
CMD ["node", "backend/server.js"]
