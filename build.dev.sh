cat > docker-compose.yml << EOF
services:
  dev:
    build:
      context: .
      target: dev
    ports:
      - "8000:8000"
      - "8001:8001"
    restart: on-failure
    networks:
      - webnet
      - redis
      - postgres
    env_file: .env
networks:
  webnet:
    driver: bridge
  redis:
    external: true
  postgres:
    external: true
EOF

git pull
docker compose build
docker compose up -d --remove-orphans
