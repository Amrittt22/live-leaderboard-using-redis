FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY backend ./backend
COPY frontend ./frontend

EXPOSE 3000
CMD ["npm", "start"]
