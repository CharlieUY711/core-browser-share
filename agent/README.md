# Core Agent

Agente de control remoto para Core Browser Share.

## Instalación

```bash
cd agent
pnpm install
pnpm build
```

## Uso

```bash
# Con variable de entorno
cp .env.example .env
# Editá .env con tus credenciales

node dist/index.js 481932
```

## Requisitos

- Node.js 18+
- Las mismas credenciales de Supabase que la app web
