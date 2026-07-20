# Instalación demo — AI Office (happy path)

Registro creado en **clawhub** (control plane) y verificado end-to-end el 2026-06-17.

## Código de instalación

```
C3ZB-5EBC
```

- **Firma:** AI Office — Demo equipo
- **Válido hasta:** 2026-07-17 (30 días)
- **Seats:** 5 PCs (0 usados)
- **Paquete:** baseline v1 — 5 archivos (openclaw.json, overlay-config, manifiesto, install.sh, .env.example), keyless (provider `ollama`, sin claves en destino).

## Qué hace el instalador con el código

1. `POST clawhub-three.vercel.app/api/v0/pair` con el código → recibe `instance_token`, liga la **MAC** del PC y consume un seat.
2. La respuesta trae `promoted_baseline_id` → descarga el paquete con
   `GET /api/v0/baselines/<id>` (Bearer instance_token).
3. Extrae el paquete y provisiona el overlay (`provision_from_package` /
   `setup-from-config.ps1`) → arranca gateway + bridge + consola.

> Verificado en vivo: el `pair` con un código de prueba devolvió el token + el
> baseline promovido, y la descarga del baseline trajo los 5 archivos con el
> sha256 de `openclaw.json` correcto.

## Hueco pendiente (el .exe)

clawhub aún **no tiene publicado un instalador** (`StackBundle` kind=INSTALLER),
así que `GET /api/v0/installer?channel=stable` devuelve `no_installer_published`.
Para que el equipo descargue un `.exe`:

1. Compilar `ai-office-install` (rama `feat/consume-configurator-package`,
   `cargo tauri build`).
2. Subir el `.exe` a un hosting (GitHub Releases / R2 / Drive).
3. Registrarlo: `POST /api/v0/bundles/register` (Bearer OPERATOR_API_KEY) con
   `kind: "INSTALLER"`, `downloadUrl`, `sha256`, `sizeBytes`.

Hecho eso, el enlace `/api/v0/installer?channel=stable&pairing=C3ZB-5EBC` ya
sirve el ejecutable y el flujo queda completo desde cero.
