# Auditoría OR Postventa VW

Aplicación web para auditorías de postventa orientada a uso móvil, preparada para trabajar solo con Google Sheets mediante Apps Script y, opcionalmente, con Firebase como capa adicional.

## Stack

- React 19 + Vite
- TypeScript
- Tailwind CSS 4
- Firebase Auth + Firestore
- Recharts para reportes

## Funcionalidades actuales

- Auditoría móvil optimizada por categoría
- Estructura configurable de categorías e ítems desde `ConfiguracionAuditoria` en Google Sheets
- Bloques operativos y criticidad para ordenar el recorrido del auditor
- Ítems obligatorios y opcionales con validación al cierre
- Guía operativa por ítem y observación obligatoria en desvíos críticos
- Persistencia principal en Firestore
- Sincronización opcional con Google Sheets mediante Apps Script
- Evidencias fotográficas por ítem con carga a Google Drive a través de Apps Script
- Importación de historial desde Apps Script usando `Auditorias` y `AuditoriaItems`

## Requisitos

- Node.js 20 o superior
- Endpoint publicado de Google Apps Script si querés enviar auditorías a Sheets y guardar evidencias en Drive
- URL pública CSV de Google Sheets si querés sincronizar historial desde Sheets
- Proyecto Firebase configurado solo si también querés autenticación y persistencia en Firestore

## Variables de entorno

Copiá [.env.example](.env.example) a `.env.local` y completá lo necesario.

Firebase es opcional. Si querés trabajar solo con Apps Script, Google Sheets y almacenamiento local, podés dejar sin definir todas las variables `VITE_FIREBASE_*`.

- `VITE_FIREBASE_PROJECT_ID`: ID del proyecto Firebase
- `VITE_FIREBASE_APP_ID`: App ID web de Firebase
- `VITE_FIREBASE_API_KEY`: Web API key del proyecto Firebase
- `VITE_FIREBASE_AUTH_DOMAIN`: dominio de Authentication
- `VITE_FIREBASE_DATABASE_ID`: ID de la base Firestore, normalmente `(default)`
- `VITE_FIREBASE_STORAGE_BUCKET`: bucket de Storage
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: sender ID del proyecto
- `VITE_FIREBASE_MEASUREMENT_ID`: opcional si usás Analytics
- `VITE_APP_TITLE`: nombre visible de la aplicación
- `VITE_APPS_SCRIPT_URL`: endpoint `exec` de Apps Script para alta de auditorías y lectura de historial consolidado
- `VITE_SHEET_CSV_URL`: URL pública CSV del Google Sheet como respaldo o verificación externa

## Arquitectura recomendada de datos

- Firestore como base principal y fuente de verdad
- Google Sheets como espejo operativo y soporte de reportes

### Firestore

Colección principal: `audits`

Campos recomendados por documento:

- `id`
- `date`
- `auditorId`
- `location`
- `staffName`
- `role`
- `items`
- `totalScore`
- `notes`
- `createdAt`
- `userEmail`

Cada ítem dentro de `items` guarda:

- `id`
- `question`
- `category`
- `status`
- `comment`

### Google Sheets

Usar dos pestañas:

- `Auditorias`: una fila por auditoría nueva
- `AuditoriaItems`: una fila por respuesta auditada nueva

La app ya envía un payload estable para este modelo y el Apps Script listo quedó en [apps-script/Code.gs](apps-script/Code.gs).

La guía operativa de alta quedó en [apps-script/README.md](apps-script/README.md). La plantilla y las reglas de la hoja maestra están en [apps-script/CONFIGURACION.md](apps-script/CONFIGURACION.md).

Si el Apps Script tiene configurada la propiedad `DRIVE_FOLDER_ID`, las fotos adjuntas por el auditor se suben a esa carpeta y en Sheets queda guardada solo la URL pública.

## Desarrollo local

1. Instalá dependencias con `npm install`
2. Configurá `.env.local`
3. Ejecutá `npm run dev`
4. Abrí `http://localhost:3000`

La estructura de auditoría se administra desde la pantalla de Reportes.

## Scripts

- `npm run dev`: servidor local
- `npm run typecheck`: validación TypeScript
- `npm run build`: build de producción
- `npm run preview`: previsualización local de la build

## Alta técnica

Antes de publicar, verificá:

1. `.env.local` existe solo en tu entorno local y contiene la configuración Firebase correcta.
2. [firestore.rules](firestore.rules) están desplegadas y alineadas con los usuarios reales.
3. Las URLs de Apps Script y CSV público están configuradas por entorno o desde la pantalla de Reportes.
4. El login de Google está habilitado en Firebase Authentication.
5. Existe una colección `audits` en Firestore con permisos válidos para lectura/escritura.
6. Si usás Sheets, publicaste el Apps Script como aplicación web y cargaste su URL `exec`.
7. Si vas a guardar estructura compartida en Firestore, el usuario debe tener rol `admin` para escribir en `appConfig`.

## Publicación en GitHub

El repo quedó preparado para subirse sin exponer tu configuración real si mantenés fuera de Git estos archivos y valores:

- `.env.local`
- URLs reales de Apps Script y CSV si no querés hacerlas públicas
- cualquier credencial o export de Firebase fuera del `.env.example`

Para entornos públicos, usá un proyecto Firebase separado de producción o uno de demo.

### GitHub Pages

El proyecto quedó listo para publicarse desde GitHub Pages usando GitHub Actions.

Configuración necesaria en GitHub:

1. Subí el repo a GitHub.
2. En Settings > Pages, elegí `GitHub Actions` como fuente.
3. En Settings > Secrets and variables > Actions, cargá estas variables o secretos según tu caso:
	- `VITE_APPS_SCRIPT_URL`: URL `exec` de tu Apps Script
	- `VITE_SHEET_CSV_URL`: URL pública CSV del Sheet si querés importar historial
	- `VITE_APP_TITLE`: opcional
4. Hacé push a `main` y GitHub Actions hará el build y deploy automático.

Notas:

- La app usa `base: './'`, así que no depende del nombre del repositorio para resolver assets en GitHub Pages.
- Como la navegación interna usa hash, no hace falta configurar redirects especiales en Pages.
- Si trabajás solo con Sheets, no necesitás cargar variables `VITE_FIREBASE_*`.

## Estado actual

- `npm run typecheck`: OK
- `npm run build`: OK
- La build usa división manual de chunks para mejorar la entrega inicial
