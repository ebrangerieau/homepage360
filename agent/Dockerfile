FROM node:20-alpine

# Install iputils for ping command
RUN apk add --no-cache iputils

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

CMD ["node", "agent.js"]
