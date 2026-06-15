# Core Browser Share

Compartí una ventana del navegador en tiempo real con otro usuario mediante un código de sesión de 6 dígitos. Sin instalaciones, sin cuentas.

**URL de producción:** `https://cora.core.com.uy`

---

## Arquitectura

```
Host                        Viewer
 │                             │
 │  getDisplayMedia()          │
 │  ──── WebRTC offer ────>    │
 │  <─── WebRTC answer ────    │
 │  ──── ICE candidates ──>    │
 │                             │
 └──── video stream (P2P) ──> └── renderiza en <video>
```

La señalización (SDP + ICE) se intercambia mediante **Supabase Realtime** (broadcast channels). El stream de video viaja peer-to-peer vía **WebRTC**, sin pasar por el servidor.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 + React 19 |
| Lenguaje | TypeScript (strict) |
| Estilos | TailwindCSS |
| Base de datos | Supabase (PostgreSQL) |
| Tiempo real | Supabase Realtime |
| Video P2P | WebRTC |
| Deploy | Vercel |

---

## Estructura del proyecto

```
core-browser-share/
├── app/
│   ├── layout.tsx              # Layout raíz con header
│   ├── page.tsx                # Home: crear o unirse
│   └── session/[code]/
│       └── page.tsx            # Sesión activa (host o viewer)
├── components/
│   ├── Host.tsx                # Captura y transmite pantalla
│   ├── Viewer.tsx              # Recibe y muestra el stream
│   └── VideoPlayer.tsx         # Wrapper de <video>
├── hooks/
│   ├── useSession.ts           # CRUD de sesiones en Supabase
│   └── useScreenShare.ts       # getDisplayMedia wrapper
├── lib/
│   ├── supabase.ts             # Cliente Supabase
│   ├── signaling.ts            # Canal de señalización Realtime
│   ├── webrtc.ts               # WebRTCHost y WebRTCViewer
│   └── control.ts              # Reservado: control remoto futuro
├── types/
│   └── index.ts                # Tipos compartidos
├── supabase/
│   └── schema.sql              # DDL inicial
├── styles/
│   └── globals.css
└── public/
    └── favicon.svg
```

---

## Instalación y desarrollo

### Prerrequisitos

- Node.js 20+
- pnpm 9+
- Cuenta en [Supabase](https://supabase.com)

### 1. Clonar y configurar variables

```bash
cp .env.example .env.local
# Editá .env.local con tus credenciales de Supabase
```

### 2. Crear la tabla en Supabase

Ejecutá el contenido de `supabase/schema.sql` en el SQL Editor de tu proyecto Supabase.

### 3. Instalar dependencias

```bash
pnpm install
```

### 4. Iniciar en desarrollo

```bash
# Desde la raíz del monorepo:
pnpm --filter core-browser-share dev

# O directamente desde este directorio:
pnpm dev
```

La app estará disponible en `http://localhost:3000`.

---

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon pública de Supabase |

---

## Supabase

### Tabla `browser_sessions`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid | Clave primaria |
| `code` | text | Código de 6 dígitos (único) |
| `created_at` | timestamptz | Timestamp de creación |
| `active` | boolean | Si la sesión está activa |

### Realtime

Cada sesión crea un canal de broadcast con el nombre `session:{code}`. Los mensajes de señalización (offer, answer, ICE candidates) viajan por este canal.

---

## WebRTC

El flujo de conexión es:

1. **Host** inicia `getDisplayMedia({ displaySurface: "window" })` — el usuario elige la ventana
2. **Host** crea un `RTCPeerConnection` y agrega el stream
3. **Viewer** se conecta al canal y envía `ready`
4. **Host** responde con un `offer` (SDP)
5. **Viewer** envía `answer`
6. Ambos intercambian candidatos ICE
7. El stream fluye peer-to-peer

---

## Despliegue en Vercel

```bash
vercel --cwd tools/core-browser-share
```

O configurá Vercel apuntando al directorio raíz del monorepo con las variables de entorno correspondientes. El archivo `vercel.json` ya incluye la configuración necesaria.

### Dominio personalizado

Configurar en Vercel: `cora.core.com.uy → core-browser-share deployment`.

---

## Funcionalidades futuras

- [ ] Control remoto (mouse/teclado) — `lib/control.ts` reservado
- [ ] Múltiples espectadores simultáneos
- [ ] Autenticación y sesiones privadas
- [ ] Audio del sistema
- [ ] Chat de texto en sesión

---

## Licencia

Proyecto interno de Core. Todos los derechos reservados.
