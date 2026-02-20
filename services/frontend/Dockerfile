# ==========================================
# Dockerfile Frontend Multi-stage 
# ==========================================
# Frontend React/Vite pour Task Manager
# Optimisé pour production : taille la plus légère possible, sécurité, performance
# Config nginx externalisée (BONNE PRATIQUE)
# ==========================================

# ==========================================
# Stage 1: Builder - Build de l'application React
# ==========================================
FROM node:18-alpine AS builder

LABEL maintainer="ESGI Docker Course"
LABEL description="Task Manager Frontend - Builder Stage"

WORKDIR /app

# Copier package.json et package-lock.json
COPY services/frontend/package*.json ./

# Installer les dépendances
RUN npm ci --prefer-offline && \
    npm cache clean --force

# Copier le code source
COPY services/frontend/. .

# Build de l'application pour production
RUN npm run build

# ==========================================
# Stage 2: Production - Serveur Nginx
# ==========================================
FROM nginx:1.25-alpine AS production

LABEL description="Task Manager Frontend - Production"
LABEL version="1.0.0"

# Copier les assets buildés
COPY --from=builder /app/dist /usr/share/nginx/html

# Copier la configuration nginx depuis un fichier
# MEILLEURE PRATIQUE : Config externalisée, facile à maintenir
COPY config/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

# ==========================================
# BUILD & RUN INSTRUCTIONS
# ==========================================
# Build:
#   docker build -t task-manager:frontend .
#
# Run:
#   docker run -d --name frontend -p 8080:80 task-manager:frontend
#
# Vérifier:
#   docker images task-manager:frontend  # ~40-48MB
#   curl http://localhost:8080
# ==========================================
