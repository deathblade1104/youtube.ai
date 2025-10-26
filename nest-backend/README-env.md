# Environment Setup Guide

## Quick Start

### Option 1: Using the Helper Script (Recommended)

```bash
# 1. Edit env.sample and update HOST_IP
# 2. Generate .env with expanded variables
npm run env:generate
```

### Option 2: Manual Setup

```bash
# 1. Copy the sample file
cp env.sample .env

# 2. Edit .env and replace all ${HOST_IP} with your actual IP
# e.g., replace ${HOST_IP} with 192.168.0.105
```

### Option 3: Using envsubst (Linux/Mac)

If you have `envsubst` installed:

```bash
# Export your HOST_IP
export HOST_IP=192.168.0.105

# Process and create .env
envsubst < env.sample > .env
```

## Important Notes

- **Standard `.env` files do NOT support `${VARIABLE}` syntax natively**
- The `${HOST_IP}` syntax is a template format in `env.sample`
- You must either:
  - Run `npm run env:generate` to expand variables
  - Use `envsubst` command
  - Manually replace all `${HOST_IP}` references

## Environment Variables

All the variables used in this project:

| Variable | Description | Example |
|----------|-------------|---------|
| `HOST_IP` | Common host IP for all services | `192.168.0.105` |
| `PORT` | Server port | `8080` |
| `NODE_ENV` | Environment | `development` |
| `DB_HOST` | PostgreSQL host | `${HOST_IP}` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `PG_USER` | PostgreSQL user | `postgres` |
| `PG_PASSWORD` | PostgreSQL password | - |
| `DB_NAME` | Database name | `youtube_ai` |
| `DB_SCHEMA` | Database schema | `youtube` |
| `REDIS_HOST` | Redis host | `${HOST_IP}` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | - |
| `REDIS_TTL` | Redis TTL | `3600` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key | - |
| `AWS_SECRET_ACCESS_KEY` | AWS secret | - |
| `AWS_YOUTUBE_BUCKET` | S3 bucket name | `youtube-clone-videos` |
| `USE_LOCALSTACK` | Use LocalStack | `false` |
| `AWS_S3_ENDPOINT` | S3 endpoint | `http://${HOST_IP}:4566` |
| `KAFKA_BROKERS` | Kafka brokers | `${HOST_IP}:9092` |
| `KAFKA_CLIENT_ID` | Kafka client ID | `upload-service` |
| `KAFKA_GROUP_ID` | Kafka group ID | `upload-service-group` |
| `JWT_SECRET` | JWT secret key | - |
| `JWT_EXPIRY` | JWT expiry | `15m` |
| `UMS_GRPC_URL` | gRPC URL | `${HOST_IP}:50051` |

