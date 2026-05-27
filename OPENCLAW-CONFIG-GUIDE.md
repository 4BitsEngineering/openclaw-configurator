# OpenClaw Configuration Guide
> Referencia completa para configurar y optimizar instancias OpenClaw.
> Basado en documentación oficial, issues de GitHub y mejores prácticas de la comunidad.
> Versión compatible: OpenClaw 2026.3.x

---

## Índice

1. [Arquitectura de configuración](#1-arquitectura-de-configuración)
2. [Orden de carga de ficheros](#2-orden-de-carga-de-ficheros)
3. [AGENTS.md — Reglas operativas](#3-agentsmd--reglas-operativas)
4. [SOUL.md — Personalidad y tono](#4-soulmd--personalidad-y-tono)
5. [IDENTITY.md — Identidad factual](#5-identitymd--identidad-factual)
6. [USER.md — Contexto del usuario](#6-usermd--contexto-del-usuario)
7. [TOOLS.md — Entorno y herramientas](#7-toolsmd--entorno-y-herramientas)
8. [MEMORY.md y logs diarios](#8-memorymd-y-logs-diarios)
9. [HEARTBEAT.md — Comportamiento proactivo](#9-heartbeatmd--comportamiento-proactivo)
10. [openclaw.json — Configuración de runtime](#10-openclawjson--configuración-de-runtime)
11. [Sistema de Skills](#11-sistema-de-skills)
12. [Configuración multi-agente](#12-configuración-multi-agente)
13. [Sandbox y aislamiento](#13-sandbox-y-aislamiento)
14. [Gestión de contexto y compactación](#14-gestión-de-contexto-y-compactación)
15. [Gestión de sesiones](#15-gestión-de-sesiones)
16. [Bugs conocidos y workarounds](#16-bugs-conocidos-y-workarounds)
17. [Checklist de diagnóstico](#17-checklist-de-diagnóstico)

---

## 1. Arquitectura de configuración

OpenClaw separa la configuración en dos capas que operan de forma independiente:

| Capa | Fichero | Qué controla | Prioridad |
|------|---------|--------------|-----------|
| **Runtime** | `openclaw.json` | Modelos, herramientas, permisos, sesiones, canales | Alta — gana siempre |
| **Comportamiento** | Ficheros `*.md` del workspace | Cómo piensa y actúa el agente | Guía — el agente puede ignorarla si `openclaw.json` la contradice |

**Regla fundamental:** `openclaw.json` impone límites duros. Los ficheros `*.md` dan instrucciones blandas. Cuando hay conflicto, gana `openclaw.json`. Ejemplo: si `deny: ["exec"]` está configurado para un agente, ninguna instrucción en `AGENTS.md` puede hacer que ese agente ejecute comandos.

---

## 2. Orden de carga de ficheros

Los ficheros del workspace se cargan **una sola vez al inicio de cada sesión**, no en cada mensaje. El orden de inyección en el system prompt es:

```
AGENTS.md → SOUL.md → USER.md → IDENTITY.md → TOOLS.md → MEMORY.md
```

### Límites de caracteres (crítico)

| Límite | Valor | Consecuencia si se supera |
|--------|-------|--------------------------|
| Por fichero | 20.000 caracteres | Se trunca silenciosamente desde el final |
| Total de todos los ficheros | 150.000 caracteres | Los ficheros al final del orden se truncan primero |

> **Regla práctica:** Mantén AGENTS.md + SOUL.md + IDENTITY.md por debajo de 8.000 caracteres en total para dejar margen a MEMORY.md, que es el más dinámico.

### Ficheros especiales con carga distinta

| Fichero | Cuándo carga |
|---------|-------------|
| `HEARTBEAT.md` | En cada ciclo de heartbeat (no en mensajes normales) |
| `BOOT.md` | Tras cada reinicio del gateway |
| `BOOTSTRAP.md` | Solo en la primera ejecución — eliminar después |
| `memory/YYYY-MM-DD.md` | El de hoy y ayer se cargan automáticamente; los anteriores, solo bajo demanda |

---

## 3. AGENTS.md — Reglas operativas

**Propósito:** Define *cómo trabaja* el agente. Es la capa de comportamiento operativo, no de identidad ni tono.

### Qué va aquí

- Ritual de arranque de sesión (qué ficheros leer y cuándo)
- Estrategia de memoria (qué loguear, qué cargar en startup vs bajo demanda)
- Cómo abordar tareas: cuándo preguntar vs cuándo ejecutar directamente
- Delegación de herramientas: CLI, subagentes, respuesta directa
- Reglas de seguridad: qué requiere confirmación, qué está prohibido
- Formato por plataforma: Discord, WhatsApp, TTS, iMessage
- Comportamiento en chats de grupo
- Reglas de heartbeat y comportamiento proactivo

### Qué NO va aquí

- Nombre e identidad del agente → `IDENTITY.md`
- Tono y personalidad → `SOUL.md`
- Información del usuario → `USER.md`
- Entorno y herramientas → `TOOLS.md`
- Hechos aprendidos → `MEMORY.md`

### Reglas de redacción

- **Específico > vago:** "confirmar antes de borrar cualquier fichero" funciona mejor que "sé cuidadoso"
- **Medible > aspiracional:** "máximo 5 bullets por respuesta" funciona mejor que "sé conciso"
- **Prohibiciones explícitas** funcionan mejor que sugerencias
- **Cada regla debe ser testeable:** si no puedes verificar que se cumple, reescríbela

### Reglas críticas que debe tener toda instancia

```markdown
## Ejecución

- Cuando listes pasos que vas a hacer → ejecútalos en esa misma respuesta, no en la siguiente
- Sigue ejecutando hasta que la tarea esté completa o necesites información que no puedes obtener tú solo
- No envíes mensajes ni notificaciones a mitad de un workflow — ejecuta todo primero, resumen al final
- En tareas largas: reporta hitos conforme los completas ("✅ Paso 1 hecho. Ahora: paso 2...")
- Si estás en modelo de respaldo y la tarea requiere cadenas de herramientas: avisa en lugar de intentarlo y fallar

## Cuándo preguntar

- Cuando necesitas información específica que no puedes inferir ni encontrar
- Cuando la acción es externa e irreversible (enviar email, publicar, borrar datos en producción)
- Cuando hay ambigüedad real que cambia el resultado de forma significativa
- Nunca preguntes para confirmar que entendiste, si procedes con la tarea obvia, o sobre duración estimada
```

### Estructura recomendada

```markdown
# AGENTS.md

## Every Session
[Qué ficheros leer al iniciar sesión y en qué orden]

## Memory
[Qué loguear, qué cargar, dónde guardar qué tipo de información]

## How to Work
[Cuándo ejecutar vs preguntar, cómo abordar tareas complejas]

## Coding Tasks
[Si aplica: cuándo usar CLI, cuándo responder directo, qué CLIs usar]

## Safety & Privacy
[Acciones que requieren confirmación, qué nunca hacer]

## Platform Formatting
[Reglas por canal: WhatsApp, Discord, Telegram, TTS]

## Group Chats
[Cuándo responder, cuándo callar, cómo participar]

## Heartbeat
[Qué verificar, cuándo avisar, cuándo no molestar]
```

---

## 4. SOUL.md — Personalidad y tono

**Propósito:** Define *quién es* el agente y *cómo habla*. Es la capa de carácter, no de reglas de trabajo.

### Qué va aquí

- Framing del rol (1-2 frases que definen la esencia del agente)
- Estilo de comunicación con reglas concretas y medibles
- Valores core y guardrails de comportamiento en situaciones ambiguas
- Contexto de dominio del usuario (stack, tipo de proyectos, sector) ← evita que el agente sea genérico sin necesidad de repetirlo en cada conversación

### Qué NO va aquí

- Reglas operativas de trabajo → `AGENTS.md`
- Nombre y capacidades técnicas → `IDENTITY.md`
- Datos de contacto o proyectos específicos → `USER.md` o `MEMORY.md`

### Consejos

- Mantén bajo **2.000 palabras** — se carga en cada sesión
- Empieza con ~10 líneas y amplía basándote en uso real, no en suposiciones
- Reglas concretas y medibles siempre: "No markdown tables en Telegram" > "adapta el formato al canal"
- Permite que el agente proponga edits a este fichero con el tiempo — es el ciclo de vida esperado

### Estructura recomendada

```markdown
# SOUL.md

## Core Truths
[Cómo se comporta en situaciones ambiguas — 4-6 principios concretos]

## Domain Knowledge
[Stack técnico, tipo de proyectos, sector, colaboradores clave — 4-5 bullets]
[Ejemplo: "Stack: Node.js, TypeScript, PostgreSQL, React"]
[Ejemplo: "Sector: SaaS B2B para pymes — prioridad: simplicidad sobre elegancia técnica"]

## Boundaries
[Qué requiere confirmación explícita, qué es privado, qué nunca hacer]

## Vibe
[Tono general — directo, cercano, técnico, formal, etc.]

## Continuity
[Cómo gestiona la memoria entre sesiones — referencia a ficheros de memoria]
```

---

## 5. IDENTITY.md — Identidad factual

**Propósito:** Responde "¿quién eres?". Lo usa el agente cuando se presenta, responde preguntas de identidad o evalúa si puede hacer algo.

### Qué va aquí

- Nombre y rol
- Hardware donde corre (si es relevante)
- Usuario o equipo principal
- Inventario de capacidades (qué sabe hacer)
- Ecosistema de proyectos o productos conectados

### Qué NO va aquí

- Cadena de modelos LLM → ya está en `openclaw.json`, duplicarlo quema tokens en cada sesión
- Reglas operativas → `AGENTS.md`
- Tono → `SOUL.md`

**Límite recomendado:** menos de 60 líneas. Es un fichero factual, no narrativo.

---

## 6. USER.md — Contexto del usuario

**Propósito:** Da al agente una "ficha de contexto" sobre la persona con la que trabaja. Sin este fichero, cada sesión empieza en frío.

### Qué va aquí

```markdown
# USER.md

## Identity
- Nombre, zona horaria, rol

## Communication Preferences
- Idioma preferido, nivel de detalle, formato de respuestas
- Horarios de disponibilidad

## Work Context
- Proyecto principal, directorio de trabajo, stack
- Entorno de despliegue

## Authority Levels
- Qué puede aprobar el agente autónomamente
- Qué requiere confirmación explícita del usuario

## Recurring Context
- Ventanas de mantenimiento, reuniones fijas, dependencias habituales
```

### Notas importantes

- Este fichero es **estático** — no se auto-actualiza; el agente solo lo modifica si tú se lo pides explícitamente
- Es distinto de `SOUL.md` (que es sobre el agente) y `MEMORY.md` (que son hechos aprendidos)
- Revísalo periódicamente — el contexto desactualizado es peor que no tener contexto

---

## 7. TOOLS.md — Entorno y herramientas

**Propósito:** Da al agente conocimiento factual sobre tu entorno para que use las herramientas correctamente. **No es un fichero de permisos** — eso va en `openclaw.json`.

### Diferencia clave con `openclaw.json`

| `openclaw.json` tools config | `TOOLS.md` |
|------------------------------|------------|
| Qué herramientas **puede** llamar el agente | Cómo usar las herramientas **efectivamente** en tu entorno |
| Control de acceso en runtime | Conocimiento contextual |

### Qué va aquí

```markdown
# TOOLS.md

## SSH Hosts
- `dev`: dev.myapp.internal (puerto 22, usuario deploy)
- `prod`: prod.myapp.com (puerto 2222, usuario deploy, key: ~/.ssh/id_prod)

## Servicios locales
- API: http://localhost:3000
- DB Admin: http://localhost:8080
- Monitoring: http://localhost:9090

## Scripts disponibles
- `./scripts/deploy.sh <env>` — despliega a dev o prod
- `./scripts/db-seed.sh` — resetea la DB local con datos de prueba

## Convenciones de nombres
- Branches: feature/NNN-descripcion, fix/NNN-descripcion
- Entornos: dev | staging | prod
```

**Límite recomendado:** corto y factual. Cada línea consume tokens en cada sesión.

---

## 8. MEMORY.md y logs diarios

### Arquitectura de memoria (dos niveles)

OpenClaw usa memoria puramente basada en ficheros. No hay estado oculto: el agente solo "recuerda" lo que se guarda en disco.

| Nivel | Fichero | Carga | Propósito |
|-------|---------|-------|-----------|
| **Largo plazo** | `MEMORY.md` | Al inicio de cada sesión DM | Hechos duraderos, preferencias, decisiones clave |
| **Diario** | `memory/YYYY-MM-DD.md` | Hoy + ayer, automáticamente | Contexto de trabajo, notas del día, progreso |
| **Histórico** | `memory/YYYY-MM-DD.md` (pasados) | Solo bajo demanda (memory_search) | Referencia cuando se pregunta explícitamente |

### Qué va en MEMORY.md

- Preferencias permanentes del usuario
- Decisiones técnicas tomadas y por qué
- Procedimientos recurrentes acordados
- Contactos clave y sus preferencias de comunicación
- Lecciones aprendidas de incidentes anteriores

**Lo que NO va en MEMORY.md:**
- Estado de tareas en curso (va en el log diario)
- Datos de sesión efímera
- Código o diffs (hay mejores lugares para esto)
- Secretos, tokens o contraseñas (nunca en workspace files)

### Configuración de búsqueda semántica en memoria

```json5
// En openclaw.json
{
  agents: {
    defaults: {
      memorySearch: {
        enabled: true,
        provider: "local",          // Totalmente privado, sin API key
        local: {
          modelPath: "~/.openclaw/models/nomic-embed-text-v1.5-Q8_0.gguf"
          // Si omites modelPath, se descarga automáticamente (~0.6 GB)
        },
        extraPaths: ["../shared-docs"],  // Indexar directorios adicionales
        cache: {
          enabled: true,
          maxEntries: 50000
        },
        query: {
          hybrid: {
            enabled: true,
            vectorWeight: 0.7,   // Peso semántico (0-1)
            textWeight: 0.3      // Peso keyword BM25 (0-1)
          }
        }
      }
    }
  }
}
```

**Proveedores disponibles:** `local` (nomic-embed-text, privado), `openai`, `gemini`, `voyage`, `mistral`, `ollama`. El local es el más recomendado por privacidad y ausencia de coste.

### Flush automático antes de compactación

Antes de cualquier compactación, OpenClaw ejecuta un turno silencioso instruyendo al agente a guardar contexto crítico en los ficheros de memoria. Esto protege información importante en sesiones largas.

---

## 9. HEARTBEAT.md — Comportamiento proactivo

**Propósito:** Lista de verificación que el agente ejecuta en cada ciclo de heartbeat. Es el mecanismo de comportamiento proactivo.

### Cómo funciona

- Si el fichero no existe o está vacío → el ciclo de heartbeat se omite (sin coste de API)
- Si existe con contenido → el agente lo lee y ejecuta el checklist
- Se carga **solo** en ciclos de heartbeat, no en mensajes normales

### Configuración del ciclo

```json5
// En openclaw.json
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",           // Cadencia (30m, 1h, 2h...)
        target: "last"          // Canal donde notificar: last | whatsapp | telegram | discord | none
      }
    }
  }
}
```

### Qué poner en HEARTBEAT.md

```markdown
# Heartbeat Checklist

- Revisa si hay emails urgentes sin leer
- Comprueba el calendario: ¿hay algo en las próximas 2 horas?
- Si hay una tarea bloqueada desde hace más de 2 horas, anótalo en memory/YYYY-MM-DD.md
- Solo contacta al usuario si hay algo accionable — no informes de "todo está bien"
- Horario de silencio: no molestar entre 23:00 y 08:00 salvo urgencia
- Si este checklist se queda obsoleto, actualiza HEARTBEAT.md con una versión mejor
```

**Regla de oro:** pequeño y estable. Cada ítem se ejecuta en cada ciclo. El coste se acumula.

**Seguridad:** nunca incluir tokens, teléfonos, contraseñas ni datos sensibles — este fichero forma parte de cada prompt de heartbeat.

---

## 10. openclaw.json — Configuración de runtime

El fichero vive en `~/.openclaw/openclaw.json`. Acepta formato **JSON5** (comentarios `//`, comas finales, claves sin comillas). El gateway recarga la mayoría de cambios en caliente sin reinicio.

### Schema completo con anotaciones

```json5
{
  $schema: "https://docs.openclaw.ai/schema/openclaw.json",

  // ── Agentes ─────────────────────────────────────────────────────────
  agents: {
    defaults: {
      workspace: "~/.openclaw/workspace",
      model: {
        primary: "anthropic/claude-sonnet-4-6",
        fallbacks: ["openai/gpt-4o"]
        // ⚠️ No incluir modelos <7B como fallback para el agente principal
        // Los modelos de 3B tienen ~93% precisión en tool calls
        // En una cadena de 5 herramientas → ~70% éxito; en 10 → ~49%
      },
      heartbeat: {
        every: "30m",
        target: "last"
      },
      compaction: {
        mode: "safeguard",
        reserveTokens: 8000,
        keepRecentTokens: 16000,
        maxHistoryShare: 0.35,
        model: "anthropic/claude-sonnet-4-6"  // Modelo para resumir
      },
      contextPruning: {
        mode: "cache-ttl",  // cache-ttl | off
        ttl: "6h"           // Solo activo para llamadas a Anthropic API
      },
      memorySearch: {
        enabled: true,
        provider: "local",
        local: {
          modelPath: "~/.openclaw/models/nomic-embed-text-v1.5-Q8_0.gguf"
        },
        fallback: "none",
        cache: { enabled: true, maxEntries: 50000 }
      },
      sandbox: {
        mode: "non-main"   // off | non-main | all
      },
      maxConcurrent: 4,
      subagents: { maxConcurrent: 8 }
    },
    list: [
      {
        id: "main",
        default: true,
        model: {
          primary: "anthropic/claude-sonnet-4-6",
          fallbacks: ["ollama/mistral:7b"]  // Solo modelos ≥7B como fallback
        },
        tools: {
          alsoAllow: ["group:web", "group:fs", "group:runtime"],
          deny: []
        }
      }
    ]
  },

  // ── Canales ─────────────────────────────────────────────────────────
  channels: {
    telegram: {
      enabled: true,
      botToken: { source: "env", id: "TELEGRAM_BOT_TOKEN" },
      dmPolicy: "pairing"   // pairing | allowlist | open | disabled
    },
    whatsapp: {
      enabled: true,
      dmPolicy: "pairing",
      groupPolicy: "require-mention",
      healthMonitor: { enabled: true }
    }
  },

  // ── Routing de agentes ───────────────────────────────────────────────
  bindings: [
    { agentId: "main", match: { channel: "telegram" } }
  ],

  // ── Gestión de sesiones ──────────────────────────────────────────────
  session: {
    dmScope: "per-channel-peer",
    reset: {
      mode: "daily",
      atHour: 4      // Hora UTC del reset diario
    },
    threadBindings: {
      enabled: true,
      idleHours: 24
    }
  },

  // ── Gateway ──────────────────────────────────────────────────────────
  gateway: {
    port: 18789,
    bind: "127.0.0.1",
    reload: { mode: "hybrid", debounceMs: 300 }
  },

  // ── Herramientas por proveedor ───────────────────────────────────────
  tools: {
    byProvider: {
      ollama: {
        deny: ["group:web", "browser"]  // Los modelos locales no deben usar web
      }
    },
    web: {
      search: { enabled: true, provider: "brave" }
    }
  },

  // ── Skills ───────────────────────────────────────────────────────────
  skills: {
    load: { watch: true, watchDebounceMs: 250 },
    install: { nodeManager: "npm" }
  },

  // ── Cron ─────────────────────────────────────────────────────────────
  cron: {
    enabled: true,
    maxConcurrentRuns: 2,
    sessionRetention: "24h"
  }
}
```

### Referencias de secretos (nunca hardcodear tokens)

```json5
// Desde variable de entorno
{ source: "env", id: "MY_API_KEY" }

// Desde fichero
{ source: "file", path: "/run/secrets/my-key" }

// Desde gestor externo
{ source: "exec", provider: "vault", id: "my-key" }
```

---

## 11. Sistema de Skills

### Qué son

Las skills son ficheros Markdown que enseñan al agente cómo realizar tareas específicas. OpenClaw inyecta un listado compacto de skills disponibles en el system prompt, extendiendo las capacidades del agente sin aumentar el contexto base.

### Instalación

```bash
openclaw skills install <slug>              # Desde el registro de OpenClaw
openclaw skills install ./path/to/skill     # Skill local
openclaw skills list                        # Skills instaladas
openclaw skills update <slug>               # Actualizar una skill
```

Las skills se instalan en `~/.openclaw/skills/`. Cada skill tiene su propio subdirectorio con `skill.json` (manifest) y ficheros de instrucciones.

### Prioridad de carga (mayor a menor)

1. `<workspace>/skills/` — skills locales al workspace
2. `<workspace>/.agents/skills/` — skills del proyecto
3. `~/.agents/skills/` — skills personales del usuario
4. Skills gestionadas
5. Skills bundled con OpenClaw

En caso de conflicto de nombres, gana el nivel de mayor prioridad.

### Configuración en `openclaw.json`

```json5
skills: {
  load: { watch: true },
  entries: {
    "mi-skill": { enabled: true },
    "otra-skill": { enabled: false }  // Desactivar sin desinstalar
  }
}
```

### Seguridad

- Tratar las skills de terceros como código no confiable
- Revisar el contenido de `SKILL.md` antes de activar
- Instalar skills solo desde fuentes verificadas: `openclaw.ai`, `docs.openclaw.ai`, `github.com/openclaw`

---

## 12. Configuración multi-agente

### Principio de aislamiento

Cada agente tiene su propio workspace (ficheros `*.md`), directorio de estado (`agentDir`) y almacén de sesiones. **Nunca reutilizar `agentDir` entre agentes** — causa colisiones de auth y sesiones.

### Ejemplo completo

```json5
{
  agents: {
    defaults: {
      model: { primary: "anthropic/claude-sonnet-4-6" },
      workspace: "~/.openclaw/workspace"
    },
    list: [
      {
        id: "personal",
        default: true,
        workspace: "~/.openclaw/workspace-personal"
      },
      {
        id: "work",
        workspace: "~/.openclaw/workspace-work",
        model: { primary: "anthropic/claude-opus-4-6" }  // Override por agente
      },
      {
        id: "automation",
        workspace: "~/.openclaw/workspace-automation",
        tools: {
          alsoAllow: ["exec", "group:fs"],
          deny: ["message", "gateway", "browser"],
          fs: { workspaceOnly: true }
        },
        sandbox: { mode: "all", scope: "session" }
      }
    ]
  },
  bindings: [
    { agentId: "personal", match: { channel: "whatsapp", accountId: "personal" } },
    { agentId: "work",     match: { channel: "whatsapp", accountId: "work" } },
    { agentId: "automation", match: { channel: "telegram", accountId: "bot" } }
  ]
}
```

### Permisos de herramientas por agente

```json5
tools: {
  alsoAllow: ["exec", "group:fs"],     // Herramientas adicionales a los defaults
  deny: ["gateway", "cron", "message"], // Herramientas bloqueadas para este agente
  fs: { workspaceOnly: true }           // Limitar filesystem al workspace del agente
}
```

### Precedencia de bindings (de mayor a menor)

1. Match exacto por peer (DM o grupo específico)
2. Match por ID de guild/servidor + roles
3. Match por ID de cuenta
4. Match por canal
5. Agente default (fallback)

---

## 13. Sandbox y aislamiento

El sandbox aísla la ejecución de herramientas (exec, read, write, edit, browser) dentro de contenedores Docker para limitar el impacto de errores o acciones no deseadas.

### Modos

| Modo | Comportamiento | Recomendado para |
|------|---------------|-----------------|
| `"off"` | Sin sandbox; todas las herramientas en el host | Desarrollo local |
| `"non-main"` | Sandbox solo en sesiones no-DM (cron, subagentes, grupos) | **Producción — recomendado** |
| `"all"` | Todas las sesiones en contenedor | Máximo aislamiento / skills no confiables |

### Scope del contenedor

| Scope | Contenedores |
|-------|-------------|
| `"session"` (default) | Uno por sesión |
| `"agent"` | Uno por agente, reutilizado entre sesiones |
| `"shared"` | Único para todas las sesiones sandboxed |

### Acceso al workspace desde el sandbox

| `workspaceAccess` | Efecto |
|-------------------|--------|
| `"none"` (default) | Sandbox opera en `~/.openclaw/sandboxes`, sin acceso al workspace |
| `"ro"` | Workspace montado en `/agent` como solo lectura |
| `"rw"` | Acceso completo lectura/escritura al workspace |

### Configuración

```json5
sandbox: {
  mode: "non-main",
  scope: "session",
  workspaceAccess: "none",
  docker: {
    image: "openclaw-sandbox:bookworm-slim",
    setupCommand: "apt-get update && apt-get install -y ripgrep",
    network: "bridge"  // Por defecto sin red
  }
}
```

```bash
# Diagnosticar configuración efectiva
openclaw sandbox explain
```

---

## 14. Gestión de contexto y compactación

### Dos mecanismos distintos

| Mecanismo | Alcance | Persiste | Qué toca |
|-----------|---------|----------|----------|
| **Pruning** | Por request, en memoria | No | Solo outputs de herramientas (exec, file reads, búsquedas) |
| **Compactación** | Toda la conversación | Sí (en transcript) | Historial completo de mensajes |

Son complementarios: el pruning mantiene los outputs lean entre ciclos de compactación.

### Context Pruning

```json5
contextPruning: {
  mode: "cache-ttl",   // "cache-ttl" | "off"
  ttl: "6h"           // Antigüedad mínima de un output para eliminarlo
}
```

⚠️ Solo activo para llamadas a la API de Anthropic.

### Compactación

```json5
compaction: {
  mode: "safeguard",        // "safeguard" | "aggressive"
  reserveTokens: 8000,      // Tokens siempre reservados para la respuesta
  keepRecentTokens: 16000,  // Proteger los últimos N tokens de historia
  maxHistoryShare: 0.35,    // Historial no puede superar el 35% del contexto total
  model: "anthropic/claude-sonnet-4-6"
}
```

**Modos de compactación:**
- `"safeguard"`: Intenta resumir con cuidado; puede fallar silenciosamente en contextos >180k tokens
- `"aggressive"`: Activa antes para evitar fallos de límite; recomendado para sesiones largas

**Comando manual:** `/compact` en cualquier chat — compacta sin reiniciar sesión. Útil antes de iniciar tareas largas.

---

## 15. Gestión de sesiones

### Comandos disponibles en el chat

| Comando | Efecto |
|---------|--------|
| `/reset` o `/new` | Sesión nueva limpia — recarga todos los ficheros `*.md` |
| `/compact` | Compacta el contexto actual sin reiniciar |
| `/new <model>` | Sesión nueva con modelo específico |

> ⚠️ **Cuándo es obligatorio abrir sesión nueva:** después de modificar cualquier fichero `*.md` del workspace. Los cambios solo se cargan al inicio de sesión.

### Cuándo reiniciar sesión

- Tras editar `AGENTS.md`, `SOUL.md`, `IDENTITY.md` u otros ficheros de workspace
- Si el agente empieza a comportarse de forma incoherente (señal de sesión corrupta)
- Si el agente no responde durante más de 2 minutos
- Si los logs muestran "orphaned user message"

### Reinicio desde terminal

```bash
pkill -f "openclaw-gateway"
openclaw gateway start
```

Luego iniciar conversación nueva en el canal correspondiente.

### Configuración de reset automático

```json5
session: {
  reset: {
    mode: "daily",
    atHour: 4          // Hora UTC — reset diario a las 4 AM
  }
}
```

---

## 16. Bugs conocidos y workarounds

### Bug #5336 — El agente para tras llamar a la herramienta `message`

**Síntoma:** El agente ejecuta parte de la tarea, envía un mensaje o notificación intermedia, y detiene la ejecución.

**Causa:** El runtime marca la ejecución como completada después de cualquier llamada a la herramienta `message`.

**Workaround:** Incluir en `AGENTS.md`:
```markdown
No envíes mensajes ni notificaciones a mitad de un workflow.
Ejecuta todas las herramientas necesarias primero. Luego envía un único resumen al final.
```

---

### "Orphaned user message" — Sesión corrupta

**Síntoma:** El agente deja de responder o responde de forma incoherente. Los logs muestran:
```
[agent/embedded] Removed orphaned user message to prevent consecutive user turns.
```

**Causa:** El historial de conversación se corrompe — hay un mensaje de usuario sin respuesta del asistente siguiente, lo que rompe el formato de turno que espera el modelo.

**Fix:** Reiniciar el gateway + abrir sesión nueva. La sesión corrupta no se puede recuperar.

---

### Modelos pequeños en cadenas de herramientas

**Síntoma:** El agente anuncia que va a hacer cosas, pero no ejecuta ninguna herramienta.

**Causa:** Los modelos de lenguaje pequeños (<7B parámetros) no generan tool calls fiables en cadenas multi-paso. Un modelo de 3B tiene ~93% de precisión por tool call. En una cadena de 5 herramientas: ~70% de éxito. En una cadena de 10: ~49%.

**Fix:** No incluir modelos <7B como fallback para el agente principal en `openclaw.json`. Si se usan como fallback, restringirlos a respuestas de texto únicamente mediante `tools.byProvider`.

---

### Config inválida al arrancar el gateway

**Síntoma:**
```
Config invalid
File: ~/.openclaw/openclaw.json
Problem: agents.defaults.X: Unrecognized key
```

**Causa:** La versión instalada de OpenClaw no soporta esa clave de configuración.

**Fix:**
```bash
openclaw --version          # Ver versión exacta
openclaw doctor --fix       # Intentar reparación automática
```

Verificar en la documentación oficial qué claves soporta la versión instalada antes de añadirlas.

---

## 17. Checklist de diagnóstico

### El agente anuncia pero no ejecuta
- [ ] ¿Está el agente en modelo de respaldo? (respuestas más lentas, sin tool calls visibles)
- [ ] ¿Hay un modelo <7B como fallback en `openclaw.json`? → Eliminarlo
- [ ] ¿La sesión lleva mucho tiempo abierta? → `/compact` o sesión nueva
- [ ] ¿Las reglas de `AGENTS.md` dicen explícitamente "ejecuta en la misma respuesta"?

### El agente no responde en absoluto
- [ ] Revisar `~/.openclaw/logs/gateway.err.log`
- [ ] Buscar "orphaned user message" en los logs
- [ ] Reiniciar gateway + sesión nueva

### El agente ignora las reglas de AGENTS.md
- [ ] ¿Abriste sesión nueva después de editar el fichero?
- [ ] ¿El fichero supera los 20.000 caracteres? (se trunca silenciosamente)
- [ ] ¿Hay una regla en `openclaw.json` que contradice lo que pide AGENTS.md? (`openclaw.json` siempre gana)

### El agente pierde contexto en sesiones largas
- [ ] Usar `/compact` antes de iniciar tareas largas
- [ ] Comprobar que `compaction.mode` está configurado
- [ ] Verificar que el agente guarda notas en `memory/YYYY-MM-DD.md` durante la sesión

### La config es inválida al arrancar
- [ ] Ejecutar `openclaw doctor --fix`
- [ ] Verificar versión instalada con `openclaw --version`
- [ ] Validar JSON5 (buscar comas faltantes, llaves sin cerrar)

### Skills no cargan
- [ ] Revisar `~/.openclaw/logs/gateway.err.log` por "Skipping skill path"
- [ ] Verificar que las rutas de skills no apuntan fuera del `workspaceOnly` configurado
- [ ] Ejecutar `openclaw skills list` para ver qué hay instalado

---

## Referencia rápida de ficheros de workspace

| Fichero | Carga | Propósito | Tamaño ideal |
|---------|-------|-----------|-------------|
| `AGENTS.md` | Cada sesión | Reglas operativas y de comportamiento | < 4.000 chars |
| `SOUL.md` | Cada sesión | Personalidad, tono, valores | < 2.000 chars |
| `USER.md` | Cada sesión | Contexto del usuario | < 2.000 chars |
| `IDENTITY.md` | Bootstrap | Nombre, rol, capacidades | < 1.500 chars |
| `TOOLS.md` | Cada sesión | Entorno, hosts, scripts | < 1.500 chars |
| `MEMORY.md` | Cada sesión DM | Hechos y decisiones duraderas | < 8.000 chars |
| `memory/YYYY-MM-DD.md` | Hoy + ayer | Log de trabajo diario | Sin límite estricto |
| `HEARTBEAT.md` | Cada heartbeat | Checklist proactivo | < 500 chars |
| `BOOT.md` | Cada reinicio | Checklist post-arranque | < 300 chars |
| `BOOTSTRAP.md` | Solo primera vez | Onboarding inicial | Eliminar tras usar |

---

*Basado en: docs.openclaw.ai, github.com/openclaw, y mejores prácticas de la comunidad (2026)*
