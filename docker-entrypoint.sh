#!/bin/sh
set -e

# If not root, the container was started with a user: directive (e.g. K8s,
# Coolify). Skip privilege fixup and run directly.
if [ "$(id -u)" != "0" ]; then
    exec "$@"
fi

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# Adjust appuser to match the host user so bind-mounted directories are writable.
if [ "$PUID" != "0" ]; then
    groupmod -o -g "$PGID" appuser 2>/dev/null || true
    usermod -o -u "$PUID" appuser 2>/dev/null || true
fi

# Ensure writable directories exist and are owned by appuser. These are the
# only paths under /app that the process writes to (uploads, output, model
# cache, font downloads). /tmp/Ultralytics is the YOLO config cache.
mkdir -p /app/uploads /app/output /app/.cache/huggingface /app/fonts /tmp/Ultralytics
chown -R appuser:appuser /app/uploads /app/output /app/.cache /app/fonts /tmp/Ultralytics

exec gosu appuser "$@"