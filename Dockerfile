FROM cgr.dev/chainguard/node:latest AS builder

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev --silent

COPY . .

FROM cgr.dev/chainguard/node:latest
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app /app
EXPOSE 3000
# Default entrypoint provided by Chainguard image is node; override at run if needed
