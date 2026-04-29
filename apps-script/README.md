# Apps Script para Google Sheets

Este script recibe la auditoría desde la app, la escribe en dos hojas, puede subir evidencias fotográficas a Google Drive y también puede devolver el historial consolidado para rehidratar la aplicación:

- Auditorias: una fila por auditoría
- AuditoriaItems: una fila por ítem auditado

## Pasos

1. Crear un Google Sheet nuevo o usar uno existente.
2. Abrir Extensiones > Apps Script.
3. Pegar el contenido de [Code.gs](Code.gs).
4. En Configuración del proyecto > Propiedades del script, crear `SPREADSHEET_ID` con el ID del Google Sheet.
5. Si querés guardar evidencias en Google Drive, crear también `DRIVE_FOLDER_ID` con el ID de la carpeta destino.
6. Implementar como aplicación web:
   - Ejecutar como: tu usuario
   - Quién tiene acceso: Cualquiera con el enlace
7. Copiar la URL terminada en `exec`.
8. Pegar esa URL en la app, dentro de Reportes > Configuración de integraciones.

Si `DRIVE_FOLDER_ID` no está definido, las imágenes se guardan en Mi unidad del usuario que ejecuta el script.

## Endpoints disponibles

- POST a la URL `exec`: guarda la auditoría en `Auditorias` y `AuditoriaItems`; si un ítem trae una foto en base64, la sube a Drive y guarda la URL final
- POST a la URL `exec` con `{ "event": "audit_delete", "auditId": "..." }`: elimina esa auditoría de `Auditorias` y `AuditoriaItems`
- GET a la URL `exec`: responde estado del servicio
- GET a la URL `exec` con `?mode=history`: devuelve `summaryRows` e `itemRows` para sincronizar el historial completo desde la app

Podés agregar `&limit=200` para limitar la cantidad de auditorías devueltas.

## Hojas esperadas

El script crea automáticamente estas pestañas si no existen:

- `Auditorias`
- `AuditoriaItems`

## Columnas de Auditorias

- `auditId`
- `submittedAt`
- `auditDate`
- `location`
- `auditorId`
- `auditorName`
- `role`
- `staffName`
- `totalScore`
- `passCount`
- `failCount`
- `naCount`
- `answeredCount`
- `itemsCount`
- `notes`
- `submittedByEmail`

## Columnas de AuditoriaItems

- `auditId`
- `submittedAt`
- `auditDate`
- `location`
- `auditorName`
- `role`
- `staffName`
- `questionIndex`
- `question`
- `status`
- `statusLabel`
- `comment`
- `photoUrl`
