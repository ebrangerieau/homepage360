FROM node:20-alpine

WORKDIR /app

# Copy all application files first
COPY . .

# Install server dependencies
WORKDIR /app/server
RUN npm install --production

# Back to app root for proper paths
WORKDIR /app/server

EXPOSE 3000

CMD ["node", "index.js"]
