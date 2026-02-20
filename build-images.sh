#!/bin/bash
set -e

IMAGE_TAG="${1:-latest}"
OUTPUT_DIR="./docker-images"

echo "Building images with tag: $IMAGE_TAG"

mkdir -p "$OUTPUT_DIR"

# Build images
# docker build -t agent-eval-backend:"$IMAGE_TAG" -f apps/backend/Dockerfile .
docker build -t agent-eval-frontend:"$IMAGE_TAG" -f apps/frontend/Dockerfile .

# Save images as tar files
echo "Saving images to $OUTPUT_DIR..."
# docker save agent-eval-backend:"$IMAGE_TAG" | gzip > "$OUTPUT_DIR/agent-eval-backend-$IMAGE_TAG.tar.gz"
docker save agent-eval-frontend:"$IMAGE_TAG" | gzip > "$OUTPUT_DIR/agent-eval-frontend-$IMAGE_TAG.tar.gz"

echo ""
echo "Done! Images saved to $OUTPUT_DIR/"
ls -lh "$OUTPUT_DIR"
echo ""
echo "To deploy on the VM:"
echo "  1. Copy docker-images/, docker-compose.prod.yml, and .env to the VM"
echo "  2. Load images:  docker load < docker-images/agent-eval-backend-$IMAGE_TAG.tar.gz"
echo "  3.               docker load < docker-images/agent-eval-frontend-$IMAGE_TAG.tar.gz"
echo "  4. Run:          docker-compose -f docker-compose.prod.yml up -d"
