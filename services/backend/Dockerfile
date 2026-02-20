# ==========================================
# Dockerfile Backend - Task Manager
# ==========================================

# ------------------------------------------
# Stage 1 : installation des dépendances de production
# ------------------------------------------
# Image Node.js légère basée sur Alpine, adaptée pour la prod
FROM node:18-alpine AS dependencies

# Répertoire de travail dans le conteneur
WORKDIR /app

# On copie uniquement les infos de dépendances
COPY services/backend/package*.json .

# Installation des dépendances de PRODUCTION uniquement
# - npm ci : installation propre et déterministe
# - --only=production : pas de dépendances de dev
# - --ignore-scripts : plus de sécurité (pas de scripts NPM exécutés)
# On nettoie ensuite le cache npm pour alléger l'image

RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force


# ------------------------------------------
# Stage 2 : builder - préparation de l'application
# ------------------------------------------
# Nouveau stage basé sur la même image Node alpine
FROM node:18-alpine AS builder

WORKDIR /app

# On récupère les node_modules déjà installés au stage précédent
# Cela évite de réinstaller les dépendances plusieurs fois
COPY --from=dependencies /app/node_modules ./node_modules

# On copie le code source de l'application backend
COPY services/backend/package*.json ./package.json
COPY services/backend/src/ ./src/


# ------------------------------------------
# Stage 3 : image de production finale
# ------------------------------------------
# Image finale qui sera réellement exécutée en production
FROM node:18-alpine AS production

# Installation de quelques outils système :
# - curl : utilisé par le HEALTHCHECK pour tester /health
# - dumb-init : petit init process qui gère proprement les signaux (SIGTERM, SIGINT)
#   → évite les process zombies et permet un arrêt propre de Node
RUN apk add --no-cache curl dumb-init && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# On copie les dépendances (node_modules) depuis le stage "dependencies"
# --chown=node:node : on donne la propriété des fichiers à l'utilisateur 'node'
# pour éviter les problèmes de droits quand on n'est pas root
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules

# On copie le code source depuis le stage "builder"
# Toujours avec --chown=node:node pour garder des permissions propres
COPY --from=builder --chown=node:node /app/package*.json ./package.json
COPY --from=builder --chown=node:node /app/src/ ./src/

# Définition des variables d'environnement par défaut pour l'API
# Elles peuvent être surchargées au lancement avec `-e`
ENV NODE_ENV=production \
    API_PORT=3000 \
    API_HOST=0.0.0.0 \
    DB_HOST=postgres \
    DB_PORT=5432 \
    DB_USER=taskuser \
    DB_PASS=secure_password_change_me \
    DB_NAME=tasks_db \
    REDIS_HOST=redis \
    REDIS_PORT=6379

# Le backend écoute sur le port 3000 dans le conteneur
EXPOSE 3000

# On n'exécute PAS le process en root pour des raisons de sécurité
# L'image officielle Node fournit déjà l'utilisateur 'node'
USER node

# Healthcheck : permet à Docker de savoir si le service est en bonne santé
# Toutes les 30s, Docker exécute cette commande :
# - si curl /health retourne une erreur, le conteneur est marqué "unhealthy"
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# On utilise dumb-init comme entrypoint pour gérer correctement les signaux
ENTRYPOINT ["dumb-init", "--"]

# Commande de démarrage de l'application
# (équivalent au script "start": "node src/index.js" du package.json)
CMD ["node", "src/index.js"]
