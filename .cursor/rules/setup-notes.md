# Cursor Setup Notes

## Model preferences
- Default: claude-sonnet-4 (for code edits)
- For complex reasoning: claude-opus-4.6
- For simple replacements: fast model

## Extensions needed
- (перечисли свои расширения)

## Docker
docker compose up -d
# App: localhost:3000
# DB: localhost:5432
# Redis: localhost:6379

## Env
cp .env.example .env
# Fill in: DATABASE_URL, REDIS_URL, OPENROUTER_API_KEY, NEXTAUTH_SECRET

## First run
pnpm install
pnpm prisma migrate dev
pnpm dev
```

4. Закоммить всё:
```
git add -A
git commit -m "checkpoint: full project state before account switch"