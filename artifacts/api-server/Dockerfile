FROM node:20-alpine

WORKDIR /app

# Copiar package files
COPY package.json pnpm-lock.yaml ./

# Instalar pnpm y dependencias
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copiar código fuente
COPY . .

# Build (si aplica)
RUN pnpm run build || true

# Exponer puerto
EXPOSE 8080

# Iniciar servidor
CMD ["pnpm", "run", "dev"]
