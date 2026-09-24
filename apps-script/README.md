# Apps Script para Google Sheets

Este script recibe auditorias desde la app, guarda el historial, sube evidencias opcionales a Google Drive y sirve la configuracion editable de cada area.

## Instalacion

1. Crea o abre el Google Sheet.
2. Abre **Extensiones > Apps Script** y pega [Code.gs](Code.gs).
3. En **Propiedades del script**, crea `SPREADSHEET_ID` con el ID del Sheet.
4. Opcionalmente crea `DRIVE_FOLDER_ID` con la carpeta de evidencias.
5. Implementa como aplicacion web: ejecutar como tu usuario y acceso para cualquiera con el enlace.
6. Copia la URL terminada en `exec` en la seccion de Integraciones de la app.

## Pestañas que crea

- `Auditorias`: una fila por auditoria cerrada.
- `AuditoriaItems`: una fila por respuesta registrada.
- `Auditoria - ...`: una pestaña de configuracion por cada area. Se crean al usar **Estructura > Guardar en Sheet**.

La configuracion por area esta explicada en [CONFIGURACION.md](CONFIGURACION.md).

## Endpoints

- `GET .../exec`: estado del servicio.
- `GET .../exec?mode=history`: historial de auditorias.
- `GET .../exec?mode=structure`: todas las areas y preguntas de las pestañas `Auditoria - ...`.
- `POST { "event": "audit_submitted", ... }`: guarda una auditoria.
- `POST { "event": "audit_delete", "auditId": "..." }`: elimina esa auditoria y sus respuestas.
- `POST { "event": "structure_replace", "scope": "global", "categories": [...] }`: crea o actualiza las pestañas de configuracion por area. La app lo usa al elegir **Guardar en Sheet**.

Se puede agregar `&limit=200` a `mode=history` para limitar la cantidad de auditorias devueltas.