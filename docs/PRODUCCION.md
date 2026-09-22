# Guía de despliegue y operación de Pliego

Esta guía cubre el despliegue de la aplicación actual en un servicio Node.js persistente. Pliego utiliza React Router v7 Framework Mode: no se debe publicar como sitio estático. Necesita que el proceso Node atienda loaders/actions para autenticación, correo y proyectos.

## 1. Componentes necesarios

- **Runtime:** Node.js 22.12+; Node 24 en la imagen Docker incluida. Mantén el servicio activo y expuesto detrás de un proxy HTTPS.
- **MongoDB:** instancia administrada con TLS, autenticación, usuario de aplicación y respaldos automáticos. Concede a la aplicación acceso solo a su base de datos.
- **Correo:** Resend con dominio remitente verificado y `RESEND_FROM_EMAIL` válido.
- **DNS/TLS:** un dominio propio apuntando al servicio; HTTPS debe terminar en la plataforma o proxy.
- **Secretos:** almacén del proveedor para variables confidenciales; nunca los incorpores a Git, imagen o logs.

No se incluye un proveedor de hosting específico. Cualquier PaaS/VM/container host que ejecute Node y permita definir variables y el puerto HTTP es adecuado.

## 2. Variables de entorno

Configura lo siguiente en el entorno del servicio:

```env
NODE_ENV=production
APP_URL=https://tu-dominio.example
SESSION_SECRET=<secreto aleatorio de al menos 32 caracteres>
MONGODB_URI=<URI TLS de MongoDB>
MONGODB_DB_NAME=pliego
RESEND_API_KEY=<clave privada de Resend>
RESEND_FROM_EMAIL=Pliego <acceso@tu-dominio.example>
AUTH_CODE_TTL_MINUTES=10
AUTH_RESEND_COOLDOWN_SECONDS=60
GUEST_MAX_PAGES=12
FREE_MAX_PAGES=30
PREMIUM_MAX_PAGES=200
TRUST_PROXY=false
```

`APP_URL` debe ser el origen público canónico en HTTPS, sin barra final y con el mismo hostname que usan los usuarios. La aplicación valida `Origin` de solicitudes mutables contra este origen. Si publicas en más de un hostname, redirígelos al canónico en el proxy.

Genera un `SESSION_SECRET` nuevo y único para cada entorno. Por ejemplo, genera localmente 48 bytes aleatorios con `openssl rand -base64 48` y pega el resultado en el gestor de secretos. No lo compartas ni lo reutilices entre staging y producción. Rotarlo invalida sesiones y cookies existentes.

Establece `TRUST_PROXY=true` solo si el proxy de entrada elimina el `X-Forwarded-For` recibido del cliente y escribe el valor real de la conexión. Esta opción permite que el rate limit distinga IPs. Si el host no garantiza ese comportamiento, conserva `false`; nunca confíes en un header que el usuario pueda manipular.

El servidor usa `PORT` para escuchar cuando la plataforma lo define (por defecto 3000 con `react-router-serve`). No configures el servicio como serverless/estático si no es compatible con el runtime y el acceso a MongoDB.

## 3. Preparación de MongoDB

1. Crea una base de datos dedicada y un usuario con permisos de lectura/escritura limitados a esa base.
2. Habilita TLS y restringe la lista de IP de entrada a la salida de tu host cuando el proveedor lo permita.
3. Configura `MONGODB_URI` en el gestor de secretos y `MONGODB_DB_NAME`.
4. Despliega y ejecuta un flujo de acceso y de guardado para que Mongoose cree colecciones e índices declarados en los modelos.
5. Confirma en MongoDB la presencia de índices TTL para vencimiento de códigos, sesiones y rate limits, e índices de consulta de proyectos.
6. Activa backups gestionados y comprueba que existe un procedimiento probado para restaurarlos.

Los índices se definen en `app/models/index.server.ts`; confirma su creación al iniciar por primera vez y tras cambios de esquema. La limpieza TTL de MongoDB es eventual, no instantánea: el código además valida explícitamente los vencimientos antes de aceptar un código o sesión.

## 4. Preparación de Resend

1. Añade y verifica el dominio remitente en Resend.
2. Publica los registros DNS de autenticación que indique Resend (SPF/DKIM y DMARC recomendado) y espera la verificación.
3. Crea una API key de alcance mínimo para este servicio.
4. Configura `RESEND_API_KEY` y `RESEND_FROM_EMAIL` con un remitente del dominio verificado.
5. Envía un código a una dirección controlada y comprueba entrega, formato móvil, remitente y enlaces de privacidad.

En `NODE_ENV=production`, la aplicación exige las credenciales y nunca escribe el código al log como alternativa. Los eventos de autenticación registran únicamente identificadores hash, no códigos ni tokens.

## 5. Despliegue con Node

Desde una revisión de código aprobada:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm start
```

Configura el build command como `pnpm install --frozen-lockfile && pnpm build`, el start command como `pnpm start`, el directorio de trabajo como raíz del proyecto y el puerto según `PORT` del proveedor. Es preferible ejecutar lint, typecheck y pruebas como checks de CI antes de promover el artefacto.

No ejecutes `pnpm dev` en producción. Conserva los logs del proceso para diagnóstico, aplica límites de memoria/CPU razonables y configura reinicio automático ante fallo. Si despliegas varias réplicas, comparte MongoDB y conserva una clave de sesión idéntica entre ellas.

## 6. Despliegue con Docker

El `Dockerfile` incluido usa pnpm y el lockfile del repositorio, construye React Router en una etapa y ejecuta solo dependencias de producción en Node 24 Alpine.

```bash
docker build -t pliego:1.0.0 .
docker run --rm -p 3000:3000 --env-file /ruta-segura/pliego.env pliego:1.0.0
```

El archivo de ejemplo `/ruta-segura/pliego.env` debe ser creado por el secret manager del host y contener todas las variables requeridas, con permisos limitados al servicio. No lo guardes en el repositorio ni lo incluyas en la imagen. En producción, es preferible que el orquestador inyecte cada secreto directamente. Coloca un proxy TLS delante del puerto 3000. La imagen no incorpora `.env`, `.git`, node_modules locales ni archivos de pruebas.

## 7. Proxy, dominio y cookies

- Fuerza HTTPS y redirige HTTP a HTTPS antes de que la aplicación reciba tráfico.
- Establece `APP_URL` al origen final de HTTPS; evita servir el sitio bajo varios dominios sin redirección canónica.
- `pliego_session` se configura `HttpOnly`, `SameSite=Lax`, `Secure` en producción, `Path=/` y expiración de 30 días. El identificador persistido en MongoDB es un hash y cerrar sesión lo revoca.
- Las rutas servidor validan el origen de mutaciones; el proxy debe conservar `Origin` y `Host` correctos y no reescribirlos de forma inconsistente.
- Para habilitar límites precisos por IP, configura `TRUST_PROXY=true` solo con la garantía de sustitución del header descrita arriba.
- Los encabezados `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` y `Permissions-Policy` se fijan desde la aplicación. Configura HSTS en el proxy una vez confirmado HTTPS de extremo a extremo.

## 8. Lista antes de publicar

- [ ] `NODE_ENV=production` y todas las variables requeridas están presentes en el runtime.
- [ ] `SESSION_SECRET` es aleatorio, exclusivo del entorno y no aparece en repositorio/logs.
- [ ] `APP_URL` coincide exactamente con el dominio HTTPS canónico.
- [ ] MongoDB usa TLS, credenciales restringidas y backup automático.
- [ ] Resend muestra el dominio verificado y el remitente es válido.
- [ ] El proxy fuerza HTTPS y la configuración de `TRUST_PROXY` coincide con su comportamiento real.
- [ ] CI pasó `typecheck`, `lint`, `format:check`, `test` y `build`.
- [ ] Se probó desde navegador real: carga, edición, PDF descargable, dimensiones de página y calibración.
- [ ] Se solicitaron y validaron códigos desde correo, se confirmó cookie segura y logout/revocación.
- [ ] Se creó, reabrió, renombró y eliminó un proyecto con la cuenta propietaria; se comprobó que otra cuenta no puede abrirlo.
- [ ] Se instaló/abrió la PWA y se confirmó el fallback offline; nunca se debe mostrar información privada cacheada.
- [ ] Privacidad y términos fueron revisados para el país, operación y política de retención reales del producto.
- [ ] Hay alertas para errores del proceso, fallo de conexión MongoDB y errores de envío de Resend, sin incluir secretos ni códigos.

## 9. Después del despliegue

1. Abre el dominio desde una ventana privada y confirma que la página inicial y el editor cargan sin errores de consola.
2. Sube un JPG/PNG/WebP de prueba, configura 2 × 2 hojas Carta y genera el PDF. Verifica cuatro páginas de 612 × 792 puntos y descarga completa.
3. Usa la hoja de calibración e imprime al 100 % en una impresora conocida; verifica la medida física.
4. Solicita un código de correo, valida el acceso, recarga `/dashboard`, cierra sesión y confirma que la cookie deja de autenticar.
5. Guarda un proyecto y prueba de nuevo la ruta con una segunda cuenta de prueba; esta no debe tener acceso al recurso ajeno.
6. Revisa logs y métricas por errores, entregabilidad, latencia de MongoDB y consumo de memoria. No registres cuerpos de peticiones, códigos, tokens o imágenes.

## 10. Operación, actualización y reversión

- Publica imágenes Docker versionadas e inmutables; conserva la versión anterior hasta validar la nueva.
- Antes de un cambio incompatible de esquema, toma/valida un backup y despliega migraciones compatibles hacia adelante. Los modelos actuales no incluyen un runner de migraciones; cualquier transformación futura debe documentarse y ejecutarse explícitamente.
- Para revertir, vuelve a la imagen o artefacto anterior. Si la versión nueva cambió datos, restaura solo con el procedimiento probado de MongoDB y evalúa la pérdida de cambios posteriores.
- Rotar `SESSION_SECRET` cierra todas las sesiones. Revocar API key de Resend requiere desplegar la nueva clave antes de retirar la anterior si se necesita una transición sin interrupción.
- La PWA puede conservar assets estáticos del build anterior durante un corto periodo; los endpoints autenticados y datos privados llevan política `no-store` y no deben añadirse a caché del service worker.

## 11. Qué no está preparado todavía

La aplicación no incluye pagos, proveedor de observabilidad, backups propios de MongoDB, migraciones automáticas, almacenamiento de imagen en nube ni un endpoint de healthcheck separado. Configura observabilidad/backups en tu infraestructura y añade una comprobación de salud específica si tu plataforma la requiere. Las cuotas Premium son infraestructura de producto; no implican que haya cobro o activación de planes disponible.
