# Dockerfile for React
FROM node:16 AS build

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./

# Instalace závislostí
RUN npm install

# Copy application code
COPY . .

# Build the React app
RUN npm run build

# Fáze 2: Nasazení sestavené aplikace pomocí http-server
FROM node:16-alpine

# Instalace http-server
RUN npm install -g http-server

# Nastavení pracovního adresáře
WORKDIR /app

# Kopírování sestavených souborů z předchozí fáze
COPY --from=build /app/build /app/build

# Expose the port
EXPOSE 3000

# Command to run the application
CMD ["http-server", "build", "-p", "3000"]
