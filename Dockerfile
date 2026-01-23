FROM node:20-alpine

WORKDIR /app

# Copy server files
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --production

# Copy all application files
WORKDIR /app
COPY . .

WORKDIR /app/server

EXPOSE 3000

CMD ["node", "index.js"]
