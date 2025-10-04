#!/bin/bash

echo "🚀 Starting Supabase with Studio..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Start Supabase services
echo "📦 Starting PostgreSQL database..."
docker-compose up -d supabase-db

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Start Supabase Studio
echo "🎨 Starting Supabase Studio..."
docker-compose up -d supabase-studio

# Start Auth service
echo "🔐 Starting Auth service..."
docker-compose up -d supabase-auth

# Start Realtime service
echo "🔔 Starting Realtime service..."
docker-compose up -d supabase-realtime

echo "✅ Supabase services started!"
echo ""
echo "🌐 Supabase Studio: http://localhost:3000"
echo "🗄️  PostgreSQL: localhost:5432"
echo "🔐 Auth API: http://localhost:9999"
echo "🔔 Realtime: http://localhost:4000"
echo ""
echo "📝 Default credentials:"
echo "   Database: postgres"
echo "   Username: postgres"  
echo "   Password: postgres"
echo ""
echo "To stop services: docker-compose down"