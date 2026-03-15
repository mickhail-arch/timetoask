# PostgreSQL Backup & Restore

## Переменные окружения

```bash
PG_USER=timetoask
PG_DB=timetoask
BACKUP_DIR=/var/backups/postgres
```

## Backup

```bash
pg_dump -U $PG_USER $PG_DB > $BACKUP_DIR/backup_$(date +%Y%m%d).sql
```

## Restore

```bash
psql -U $PG_USER $PG_DB < backup.sql
```

## Ежедневный cron (ротация — последние 7 дней)

Добавить в `crontab -e`:

```cron
0 3 * * * pg_dump -U $PG_USER $PG_DB > /var/backups/postgres/backup_$(date +\%Y\%m\%d).sql && find /var/backups/postgres -name "backup_*.sql" -mtime +7 -delete
```

| Поле | Значение |
|------|----------|
| `0 3 * * *` | Каждый день в 03:00 |
| `pg_dump ...` | Создаёт дамп с датой в имени файла |
| `find ... -mtime +7 -delete` | Удаляет бэкапы старше 7 дней |
