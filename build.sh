#!/bin/sh 
set -e

cat > docker-compose.yml << EOF
services:
  trpc:
    image: rhiva-ag_trpc:latest
    ports:
      - "8000:8000"
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
      resources:
        reservations:
          cpus: "0.5"
        limits:
          cpus: "1.0"
    networks:
      - webnet
      - redis
      - postgres
    env_file: .env
    
  tasks:
    image: rhiva-ag_tasks:latest
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
      resources:
        reservations:
          cpus: "0.5"
        limits:
          cpus: "1.0"
    networks:
      - redis
      - postgres
    env_file: .env

  jobs:
    image: rhiva-ag_jobs:latest
    deploy:
      replicas: 2
      restart_policy:
        condition: on-failure
      resources:
        reservations:
          cpus: "0.5"
        limits:
          cpus: "1.0"
    depends_on:
      - tasks
    networks:
      - redis
      - postgres
    env_file: .env

  metrics:
    image: rhiva-ag_metrics:latest
    ports:
      - "8001:8001"
    deploy:
      replicas: 2
      restart_policy:
        condition: on-failure
      resources:
        reservations:
          cpus: "0.5"
        limits:
          cpus: "1.0"
    networks:
      - redis
      - postgres
    environment:
      PORT: 8001
    env_file: .env

networks:
  webnet:
    driver: overlay
  redis:
    external: true
  postgres: 
    external: true 
EOF

SERVICES="trpc tasks jobs metrics"

for service in $SERVICES; do
  docker build --target trpc -t rhiva-ag_$service:latest .
done

docker stack deploy -c docker-compose.yml rhiva-ag 
