cat > docker-compose.yml << EOF
services:
  trpc:
    build:
      context: .
      target: trpc
    ports:
      - "8000:8000"
    restart: on-failure
    networks:
      - webnet
      - redis
      - postgres
    env_file: .env

  tasks:
    build:
      context: .
      target: tasks
    restart: on-failure
    networks:
      - redis
      - postgres
    env_file: .env

  jobs:
    build:
      context: .
      target: jobs
    restart: on-failure
    depends_on:
      - tasks
    networks:
      - redis
      - postgres
    env_file: .env

  metrics:
    build:
      context: .
      target: metrics
    restart: on-failure
    ports:
      - "8001:8001"
    networks:
      - redis
      - postgres
    environment:
      PORT: 8001
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
docker compose up -d
