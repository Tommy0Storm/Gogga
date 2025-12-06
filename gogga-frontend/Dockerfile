FROM node:20

WORKDIR /app

# Set backend URL for Docker networking
ENV BACKEND_URL=http://backend:8000

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy everything else
COPY . .

# Generate Prisma client
RUN ./node_modules/.bin/prisma generate

# Copy SSL certificates
COPY certs/ ./certs/

EXPOSE 3000

# On startup: install deps (in case volume mount cleared them), generate prisma, then start
CMD sh -c "npm install && ./node_modules/.bin/prisma generate && npm run dev"
