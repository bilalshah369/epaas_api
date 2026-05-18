#!/bin/sh
set -e

echo "Resetting database and applying migrations..."
npx prisma migrate reset --force --skip-seed

echo "Seeding database...dfdf"
npm run db:seed || true  

echo "Starting server..."
exec "$@"
