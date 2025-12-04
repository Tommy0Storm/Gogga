FROM node:18

WORKDIR /app

# Set backend URL for Docker networking
ENV BACKEND_URL=http://backend:8000

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
