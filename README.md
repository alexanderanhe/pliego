# Pliego

Pliego transforma una imagen en un póster multipágina listo para imprimir. Configura tamaño, papel, márgenes y solapamiento; revisa el encuadre y descarga un PDF con una página por hoja. La imagen se procesa localmente en el navegador. Si el usuario guarda un proyecto, el servidor persiste su configuración y metadatos, nunca la imagen original.

## Estado del producto

El editor, la vista previa, los cálculos físicos y la exportación PDF funcionan sin cuenta. Las cuentas usan códigos de un solo uso enviados por correo. MongoDB guarda cuentas, sesiones y proyectos. Premium es una página informativa: todavía no se procesan pagos ni se activan suscripciones desde una pasarela.

## Stack

React Router 7.18.3 Framework Mode, React 19, Vite 7, TypeScript estricto, Tailwind CSS 4, `pdf-lib`, gestos de puntero/toque para mover y rotar el encuadre, MongoDB/Mongoose, Resend, Zod, Vitest, Playwright, ESLint y Prettier. La interfaz usa Lucide y React Icons.

## Requisitos

- Node.js 22.12 o posterior (la imagen Docker usa Node 24).
- pnpm 10.20.0, fijado por `packageManager`.
- MongoDB para autenticación, historial y proyectos.
- Una cuenta de Resend con dominio remitente verificado para enviar códigos en producción.

## Inicio local

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

Abre <http://localhost:5173>. El editor público funciona sin MongoDB. Para probar autenticación y guardado, configura MongoDB en `.env`. Si `RESEND_API_KEY` está vacío y `NODE_ENV=development`, el código de prueba aparece en la terminal del servidor con un aviso explícito. Este adaptador de consola está deshabilitado en producción.

## Configuración

Completa `.env` a partir de `.env.example`:

| Variable                       | Obligatoria en producción | Uso                                                                                                      |
| ------------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                     | Sí, `production`          | Habilita cookies seguras y validación estricta de configuración.                                         |
| `APP_URL`                      | Sí, URL HTTPS pública     | Origen canónico y comprobación de origen para mutaciones. Sin `/` final.                                 |
| `SESSION_SECRET`               | Sí                        | Secreto aleatorio de al menos 32 caracteres para hashes y cookies.                                       |
| `MONGODB_URI`                  | Sí                        | URI privada de conexión MongoDB.                                                                         |
| `MONGODB_DB_NAME`              | Sí                        | Base de datos de la aplicación.                                                                          |
| `RESEND_API_KEY`               | Sí                        | Clave privada de Resend.                                                                                 |
| `RESEND_FROM_EMAIL`            | Sí                        | Remitente perteneciente a un dominio verificado en Resend.                                               |
| `AUTH_CODE_TTL_MINUTES`        | No (10)                   | Vigencia del código; máximo 10 minutos.                                                                  |
| `AUTH_RESEND_COOLDOWN_SECONDS` | No (60)                   | Espera antes de pedir otro código; mínimo 60 segundos.                                                   |
| `GUEST_MAX_PAGES`              | No (12)                   | Máximo de hojas para invitados.                                                                          |
| `FREE_MAX_PAGES`               | No (30)                   | Máximo de hojas para cuentas gratuitas.                                                                  |
| `PREMIUM_MAX_PAGES`            | No (200)                  | Máximo de hojas Premium.                                                                                 |
| `TRUST_PROXY`                  | No (`false`)              | Actívalo solo si el proxy confiable reemplaza `X-Forwarded-For`; se usa para limitar solicitudes por IP. |

En producción la aplicación falla al iniciar si falta una variable requerida, el secreto es débil o `APP_URL` no usa HTTPS. Mantén `.env` fuera del control de versiones y administra los secretos desde el gestor de secretos de tu plataforma.

## Comandos de desarrollo y validación

```bash
pnpm dev             # servidor local
pnpm typecheck        # tipos de React Router y TypeScript
pnpm lint             # ESLint
pnpm format:check     # formato Prettier
pnpm test             # pruebas unitarias (Vitest)
pnpm test:e2e         # flujo de exportación con Playwright
pnpm build            # compilación de producción
pnpm start            # sirve build/server/index.js; compila antes
```

La primera ejecución E2E requiere instalar Chromium: `pnpm exec playwright install chromium`. Las pruebas E2E inician Vite en `127.0.0.1:5173`. Para probar códigos de acceso localmente, deja `NODE_ENV=development`, no configures `RESEND_API_KEY`, configura MongoDB y consulta la terminal donde corre `pnpm dev`.

## Despliegue de producción

La guía completa de infraestructura, Docker, MongoDB, Resend, proxy, comprobaciones previas y operación está en [docs/PRODUCCION.md](./docs/PRODUCCION.md). El proceso estándar es:

1. Aprovisionar un servicio Node.js persistente, MongoDB administrado y un dominio HTTPS.
2. Configurar las variables de producción en el proveedor.
3. Ejecutar `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test` y `pnpm build` en CI.
4. Publicar el artefacto e iniciar con `pnpm start` (o construir la imagen Docker).
5. Completar la lista de comprobación posterior al despliegue incluida en la guía.

Este proyecto no requiere un proveedor específico. El servidor usa React Router v7 Framework Mode y debe ejecutarse en un entorno Node.js que soporte el adaptador `@react-router/serve`; no es una exportación estática, porque autenticación y persistencia usan acciones de servidor.

## Arquitectura

```text
app/
  components/       controles, carga y tarjetas reutilizables
  features/
    auth/           generación y hash de códigos/tokens
    poster/         esquema, matemáticas, imagen, editor, preview y PDF
  lib/              entorno, MongoDB y capacidades de planes
  models/           modelos Mongoose e índices MongoDB
  routes/           páginas, loaders/actions y endpoints
  services/         autenticación, correo y proyectos del lado servidor
  app.css           estilos globales y utilidades de interfaz
public/             manifest, icono, service worker y página offline
tests/              pruebas matemáticas/auth y flujo Playwright
```

Las conversiones y la cuadrícula se mantienen en `app/features/poster/math.ts` como funciones puras. El mismo layout alimenta la vista previa y `app/features/poster/pdf.ts`. Los cálculos físicos parten de milímetros y se convierten a puntos PDF al dibujar (`1 in = 25.4 mm`, `72 pt/in`). Los márgenes de la impresora y el solapamiento son conceptos separados.

### Persistencia y privacidad

- `User`: identidad verificada, plan, capacidades y calibración.
- `VerificationCode`: hash del código, propósito, vencimiento, intentos y consumo; índice TTL.
- `Session`: hash del token, propietario y vencimiento; índice TTL.
- `PosterProject`: configuración y metadatos de la imagen; índices por usuario/fecha.
- `RateLimit`: contadores de acceso con vencimiento.

Las consultas de proyectos se limitan al usuario autenticado. La imagen original no se envía al servidor durante la edición ni se guarda en MongoDB. Reabrir un proyecto requiere volver a elegir el archivo original; la aplicación contrasta sus metadatos/huella con el proyecto. La PWA cachea únicamente recursos estáticos y una página offline básica, no respuestas de sesión ni datos privados. El PDF requiere conexión a la página cargada, pero su composición se hace en el navegador.

## Límites actuales

- Formatos admitidos: JPG/JPEG, PNG y WebP, sujetos a límites de tamaño y dimensiones del validador del navegador.
- Límites iniciales: invitado 12 hojas, cuenta gratuita 30 y Premium 200; están centralizados en `app/lib/product.ts` y pueden configurarse por entorno.
- No hay pagos, subida de imágenes a la nube, miniaturas remotas, exportación ZIP, semitono ni procesamiento prioritario.
- La descarga PDF es gratuita y no requiere cuenta (`DOWNLOAD_REQUIRES_ACCOUNT` en `app/lib/product.ts`).
- MongoDB y Resend son necesarios para habilitar las cuentas en producción; si no se configuran localmente, el editor público continúa disponible.

## Decisiones de producto futuras

Las capacidades y cuotas se administran desde `app/lib/product.ts`; las operaciones sensibles también se verifican en el servidor. Para integrar pagos, añade un proveedor detrás de un servicio de facturación que verifique webhooks firmados e idempotentes, actualice `plan`, `planStatus`, vencimiento y `entitlements`, y no aceptes cambios de plan enviados desde el navegador. Para agregar una capacidad, define su nombre en el tipo `Entitlement`, resuelve su autorización en `canUseFeature`, expón la opción deshabilitada con explicación en UI y verifica el permiso en la acción de servidor correspondiente.

## Documentación adicional

- [Guía de producción](./docs/PRODUCCION.md): infraestructura, variables, Docker, DNS/HTTPS, MongoDB, Resend, despliegue y operación.
- [Privacidad](./app/routes/privacy.tsx) y [términos](./app/routes/terms.tsx): páginas públicas del producto.
