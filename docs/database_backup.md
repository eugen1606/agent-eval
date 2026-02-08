# Database Backup and Restore Procedures

This document outlines procedures for backing up and restoring the PostgreSQL database used by BenchMark.

---

## Overview

BenchMark uses PostgreSQL 16 for data persistence. Regular backups are essential for:
- Disaster recovery
- Data migration between environments
- Point-in-time recovery

---

## Backup Procedures

### 1. Manual Backup (Development)

For local development using docker-compose:

```bash
# Create a backup
docker exec agent-eval-db pg_dump -U agent_eval -d agent_eval > backup_$(date +%Y%m%d_%H%M%S).sql

# Create a compressed backup
docker exec agent-eval-db pg_dump -U agent_eval -d agent_eval | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 2. Manual Backup (Production)

For production environments:

```bash
# Standard backup
docker exec agent-eval-db pg_dump -U ${POSTGRES_USER} -d ${POSTGRES_DB} -F c -f /tmp/backup.dump

# Copy backup from container
docker cp agent-eval-db:/tmp/backup.dump ./backup_$(date +%Y%m%d_%H%M%S).dump

# Clean up
docker exec agent-eval-db rm /tmp/backup.dump
```

### 3. Automated Backup Script

Create a cron job for automated backups:

```bash
#!/bin/bash
# backup.sh - Run daily via cron

BACKUP_DIR="/var/backups/benchmark"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/benchmark_${TIMESTAMP}.dump"

# Create backup directory if not exists
mkdir -p ${BACKUP_DIR}

# Create backup
docker exec agent-eval-db pg_dump -U ${POSTGRES_USER:-agent_eval} -d ${POSTGRES_DB:-agent_eval} -F c > ${BACKUP_FILE}

# Compress backup
gzip ${BACKUP_FILE}

# Delete backups older than retention period
find ${BACKUP_DIR} -name "benchmark_*.dump.gz" -mtime +${RETENTION_DAYS} -delete

# Log completion
echo "$(date): Backup completed - ${BACKUP_FILE}.gz"
```

Add to crontab for daily backups at 2 AM:
```bash
0 2 * * * /path/to/backup.sh >> /var/log/benchmark-backup.log 2>&1
```

### 4. Backup Best Practices

- **Frequency**: Daily for production, weekly for staging
- **Retention**: Keep 30 days of daily backups, 12 months of monthly backups
- **Storage**: Store backups in a separate location (S3, GCS, or remote server)
- **Encryption**: Encrypt backups at rest if they contain sensitive data
- **Verification**: Regularly test restore procedures

---

## Restore Procedures

### 1. Restore from SQL Dump

```bash
# Stop the application to prevent writes
docker stop agent-eval-backend

# Restore from plain SQL
docker exec -i agent-eval-db psql -U agent_eval -d agent_eval < backup.sql

# Or from compressed SQL
gunzip -c backup.sql.gz | docker exec -i agent-eval-db psql -U agent_eval -d agent_eval

# Restart the application
docker start agent-eval-backend
```

### 2. Restore from Custom Format Dump

```bash
# Stop the application
docker stop agent-eval-backend

# Drop and recreate database (WARNING: destructive)
docker exec agent-eval-db dropdb -U agent_eval agent_eval
docker exec agent-eval-db createdb -U agent_eval agent_eval

# Restore from custom format
docker exec -i agent-eval-db pg_restore -U agent_eval -d agent_eval < backup.dump

# Restart the application
docker start agent-eval-backend
```

### 3. Point-in-Time Recovery (Advanced)

For production systems requiring point-in-time recovery, configure PostgreSQL with WAL archiving:

```yaml
# docker-compose.prod.yml (postgres service)
environment:
  POSTGRES_INITDB_ARGS: "--data-checksums"
command:
  - "postgres"
  - "-c"
  - "wal_level=replica"
  - "-c"
  - "archive_mode=on"
  - "-c"
  - "archive_command=cp %p /var/lib/postgresql/archive/%f"
volumes:
  - postgres_data:/var/lib/postgresql/data
  - postgres_archive:/var/lib/postgresql/archive
```

---

## Data Migration

### Export Data to Another Environment

```bash
# Export specific tables
docker exec agent-eval-db pg_dump -U agent_eval -d agent_eval \
  --table=users \
  --table=tests \
  --table=runs \
  -F c > migration.dump

# Import to target
docker exec -i target-db pg_restore -U agent_eval -d agent_eval < migration.dump
```

### Reset Database (Development Only)

```bash
# WARNING: This deletes all data

# Stop backend
docker stop agent-eval-backend

# Drop and recreate
docker exec agent-eval-db dropdb -U agent_eval agent_eval
docker exec agent-eval-db createdb -U agent_eval agent_eval

# Restart backend (migrations will run automatically)
docker start agent-eval-backend
```

---

## Troubleshooting

### Common Issues

1. **Permission denied during backup**
   ```bash
   # Ensure correct ownership
   docker exec agent-eval-db chown postgres:postgres /tmp/backup.dump
   ```

2. **Database in use during restore**
   ```bash
   # Terminate active connections
   docker exec agent-eval-db psql -U agent_eval -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'agent_eval' AND pid <> pg_backend_pid();"
   ```

3. **Encoding issues**
   ```bash
   # Ensure UTF-8 encoding
   docker exec agent-eval-db pg_dump -U agent_eval -d agent_eval -E UTF8 > backup.sql
   ```

4. **Large database backup timeout**
   ```bash
   # Use custom format with compression
   docker exec agent-eval-db pg_dump -U agent_eval -d agent_eval -F c -Z 9 > backup.dump
   ```

---

## Verification Checklist

After restoring a backup, verify:

- [ ] Application starts successfully
- [ ] Users can log in
- [ ] Tests and runs are visible
- [ ] New data can be created
- [ ] Health endpoints return 200 (`/api/health/live`, `/api/health/ready`)

---

## Cloud Backup Options

### AWS S3

```bash
# Install AWS CLI in container or host
# Upload backup to S3
aws s3 cp backup.dump.gz s3://your-bucket/backups/benchmark/

# Download from S3
aws s3 cp s3://your-bucket/backups/benchmark/backup.dump.gz ./
```

### Google Cloud Storage

```bash
# Upload to GCS
gsutil cp backup.dump.gz gs://your-bucket/backups/benchmark/

# Download from GCS
gsutil cp gs://your-bucket/backups/benchmark/backup.dump.gz ./
```

---

## Emergency Contacts

In case of data loss or recovery issues:
- Check application logs: `docker logs agent-eval-backend`
- Check database logs: `docker logs agent-eval-db`
- Verify backup integrity before restore
