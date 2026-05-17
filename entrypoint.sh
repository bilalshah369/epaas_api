#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Running database seed..."
npm run db:seed || true
echo "Running database reset..."
npm run db:reset || true

echo "Starting server..."
exec "$@"