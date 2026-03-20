# AXET Onboarding Checklist (Execution)

## Fase A — Setup
- [ ] Añadir opción `Axet (Corporate / Okta)` en selector de provider
- [ ] Añadir paso de autenticación Okta Device Flow
- [ ] Añadir estados visuales: pending/success/expired/error

## Fase B — Runtime Validation
- [ ] Probar `/api/axet/auth/start`
- [ ] Probar `/api/axet/auth/poll` con aprobación móvil
- [ ] Probar `/api/axet/auth/models`
- [ ] Probar `/api/axet/auth/projects` (si aplica)

## Fase C — Config Generation
- [ ] Generar plantilla env para gateway (`.env.gateway.local`)
- [ ] Generar plantilla env para MCP (`.env.mcp.local`)
- [ ] Configurar `AXET_GATEWAY_URL` y `AXET_GATEWAY_TOKEN`

## Fase D — OpenClaw Integration
- [ ] Registrar MCP `axet-models-mcp`
- [ ] Ejecutar `axet.generate` de prueba
- [ ] Ejecutar `axet.anonymize` de prueba
- [ ] Verificar trazabilidad (`traceId`, modelo usado)

## Fase E — Security
- [ ] Confirmar que no hay secretos en git
- [ ] Rotar credenciales usadas en pruebas manuales
- [ ] Activar redacción de logs en gateway
