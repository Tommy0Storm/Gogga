# Simple TCP proxy for Next.js 16 network access bug
FROM node:22-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

COPY proxy.js .

EXPOSE 3001 3002

CMD ["node", "proxy.js"]
