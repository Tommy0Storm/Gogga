FROM cgr.dev/chainguard/node:latest

USER root
WORKDIR /app
RUN chown -R node:node /app

# Set backend URL for Docker networking
ENV BACKEND_URL=http://backend:8000
# Dummy DATABASE_URL for Prisma client generation (doesn't connect during generate)
ENV DATABASE_URL=file:/app/data/gogga.db

COPY --chown=node:node package*.json ./
USER node
RUN npm install

COPY --chown=node:node . .

# Generate Prisma client
RUN ./node_modules/.bin/prisma generate

# Copy SSL certificates (optional, for HTTPS mode if needed)
COPY --chown=node:node certs/ ./certs/

EXPOSE 3000

# Run Prisma generate using local node_modules version (not npx which downloads latest)
# Then start the dev server with HTTP (proxy handles external connections)
CMD ["sh", "-c", "./node_modules/.bin/prisma generate && npm run dev:http"]
