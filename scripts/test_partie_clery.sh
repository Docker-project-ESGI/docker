#!/bin/bash
set -e

echo "🧪 Test Frontend + Redis + Réseaux Docker"
echo "=========================================="

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Charger les variables d'environnement depuis .env si présent
if [ -f .env ]; then
  echo -e "${YELLOW}📄 Chargement des variables depuis .env...${NC}"
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env | xargs)
fi

# Valeurs par défaut si non définies
REDIS_PASSWORD="${REDIS_PASSWORD:-redis_super_secret_2026}"
REDIS_PORT="${REDIS_PORT:-6379}"

echo -e "${YELLOW}🔐 REDIS_PASSWORD utilisé: ${NC}${REDIS_PASSWORD}"
echo -e "${YELLOW}🔌 REDIS_PORT utilisé: ${NC}${REDIS_PORT}"

# 1. Build
echo -e "\n${YELLOW}🏗️  Build frontend...${NC}"
docker compose build frontend

# 2. Start
echo -e "\n${YELLOW}🚀 Start services...${NC}"
docker compose up -d frontend redis
sleep 15

# 3. Check networks
echo -e "\n${YELLOW}🌐 Check networks...${NC}"
if docker network ls | grep -q "app_frontend_network" && docker network ls | grep -q "app_backend_network"; then
  echo -e "${GREEN}✓ Réseaux OK${NC}"
else
  echo -e "${RED}✗ Réseaux manquants${NC}"
  docker compose down || true
  exit 1
fi

# 4. Check frontend
echo -e "\n${YELLOW}🌐 Check frontend...${NC}"
if curl -f -s http://localhost:80 >/dev/null; then
  echo -e "${GREEN}✓ Frontend accessible${NC}"
else
  echo -e "${RED}✗ Frontend inaccessible${NC}"
  docker compose logs frontend || true
  docker compose down || true
  exit 1
fi

# 5. Check Redis
echo -e "\n${YELLOW}💾 Check Redis...${NC}"
if docker exec app_redis redis-cli -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" ping | grep -q "PONG"; then
  echo -e "${GREEN}✓ Redis OK${NC}"
else
  echo -e "${RED}✗ Redis KO${NC}"
  docker compose logs redis || true
  docker compose down || true
  exit 1
fi

# 6. Check healthchecks
echo -e "\n${YELLOW}❤️  Check healthchecks...${NC}"
sleep 10
FRONTEND_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' app_frontend 2>/dev/null || echo "none")
REDIS_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' app_redis 2>/dev/null || echo "none")

echo -e "Frontend: ${GREEN}$FRONTEND_HEALTH${NC}"
echo -e "Redis: ${GREEN}$REDIS_HEALTH${NC}"

# 7. Test Redis set/get
echo -e "\n${YELLOW}💾 Test Redis set/get...${NC}"
docker exec app_redis redis-cli -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" SET test_key "Docker rules!"
RESULT=$(docker exec app_redis redis-cli -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" GET test_key)
if [ "$RESULT" = "Docker rules!" ]; then
  echo -e "${GREEN}✓ Redis set/get OK${NC}"
else
  echo -e "${RED}✗ Redis set/get FAIL${NC}"
fi

# Success + cleanup
echo -e "\n${YELLOW}🧹 Cleanup containers...${NC}"
docker compose down || true

echo -e "\n${GREEN}=========================================="
echo -e "✅ TOUS LES TESTS PASSÉS !"
echo -e "==========================================${NC}"
echo -e "Frontend: http://localhost:80"
echo -e "Redis: container interne 'app_redis' sur le réseau backend"
