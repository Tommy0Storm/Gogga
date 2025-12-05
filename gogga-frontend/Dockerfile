FROM node:20

WORKDIR /app

# Set backend URL for Docker networking
ENV BACKEND_URL=http://backend:8000

COPY package*.json ./
RUN npm install

COPY . .

# Copy SSL certificates
COPY certs/ ./certs/

EXPOSE 3000

CMD ["npm", "run", "dev"]
