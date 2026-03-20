# Axet Corporate Provider Pack (OpenClaw Onboarding)

## Objetivo
Incorporar Axet (con Okta) como proveedor corporativo en el onboarding de OpenClaw sin exponer credenciales en prompts/agentes.

## Flujo UX propuesto (wizard)

1. **Seleccionar proveedor**
   - Opción: `Axet (Corporate / Okta)`

2. **Autenticación corporativa (Okta Device Flow)**
   - Botón: `Iniciar login con OKTA`
   - Mostrar:
     - `user_code`
     - `verification_uri_complete`
   - Estado: pending / success / expired / error

3. **Conexión validada**
   - Mostrar usuario autenticado y expiración aproximada
   - Indicar si hay `refresh_token` (auto-renovable)

4. **Selección de modelo/proyecto**
   - Cargar modelos disponibles de Axet
   - Cargar proyectos disponibles (si aplica)
   - Elegir defaults para runtime

5. **Generación de config**
   - Generar config de gateway+MCP (sin secretos en repositorio)
   - Variables a secret store / .env local

## Arquitectura técnica recomendada

OpenClaw / Agents
→ Axet Models MCP
→ Axet AI Gateway
→ Okta
→ Axet APIs

## Variables mínimas esperadas

### Gateway
- `OKTA_ISSUER`
- `OKTA_CLIENT_ID`
- `OKTA_CLIENT_SECRET` *(si aplica; para device flow puede no usarse)*
- `OKTA_SCOPE`
- `AXET_API_BASE_URL`
- `AXET_GATEWAY_TOKEN`

### MCP cliente
- `AXET_GATEWAY_URL`
- `AXET_GATEWAY_TOKEN`
- `AXET_TIMEOUT_MS`

## API interna esperada (gateway)
- `GET /v1/health`
- `POST /v1/generate`
- `POST /v1/anonymize`

## Endpoints auth Axet/Okta (referencia)
- `POST /api/axet/auth/start`
- `POST /api/axet/auth/poll`
- `POST /api/axet/auth/refresh`
- `GET /api/axet/auth/status`

## Criterios de aceptación
- login okta end-to-end funciona
- se obtienen modelos Axet reales
- se ejecuta prompt de prueba y devuelve output
- refresh automático mantiene sesión activa
- no se persisten secretos en git
