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

# Run Prisma generate at startup then start dev server with HTTP
# Chainguard images use busybox sh at /usr/bin/sh
CMD ["/usr/bin/sh", "-c", "./node_modules/.bin/prisma generate && npm run dev:https"]
