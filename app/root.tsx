import { useEffect, useState } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  Link,
  NavLink,
  Form,
  isRouteErrorResponse,
} from "react-router";
import { Layers, ArrowUpRight, Menu } from "lucide-react";
import type { Route } from "./+types/root";
import { currentUser } from "./services/auth.server";
import { env } from "./lib/env.server";
import { pageLimit } from "./services/projects.server";
import "./app.css";
export async function loader({ request }: Route.LoaderArgs) {
  const user = await currentUser(request);
  return { user, maxPages: pageLimit(user), configured: !!env.MONGODB_URI };
}
export const headers = () => ({
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
});
export const meta = () => [
  { title: "Pliego — Tus ideas, a lo grande" },
  {
    name: "description",
    content:
      "Convierte una imagen en un póster de varias hojas. Edición local y PDF preciso listo para imprimir.",
  },
];
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#4056d6" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
export default function App({ loaderData }: Route.ComponentProps) {
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return (
    <>
      <a className="skip" href="#main">
        Saltar al contenido
      </a>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="Pliego, inicio">
          <span className="brand-icon">
            <Layers size={23} />
          </span>
          pliego<span className="brand-dot">.</span>
        </Link>
        <button
          className="mobile-menu"
          aria-label="Abrir navegación"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <Menu />
        </button>
        <nav className={menu ? "open" : ""} aria-label="Principal">
          <NavLink to="/editor">Crear un póster</NavLink>
          <NavLink to="/calibration">Calibrar impresora</NavLink>
          <NavLink to="/premium">
            Premium <span className="tiny">PRONTO</span>
          </NavLink>
        </nav>
        <div className="header-account">
          {loaderData.user ? (
            <>
              <Link to="/dashboard" className="btn btn-secondary">
                Mis proyectos
              </Link>
              <Form method="post" action="/logout">
                <button className="logout">Salir</button>
              </Form>
            </>
          ) : (
            <Link to="/login" className="login-link">
              Iniciar sesión <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </header>
      <Outlet />
      <footer className="site-footer">
        <Link to="/" className="brand small-brand">
          pliego.
        </Link>
        <span>Pequeñas hojas. Grandes posibilidades.</span>
        <div>
          <Link to="/privacy">Privacidad</Link>
          <Link to="/terms">Términos</Link>
          <span>Hecho para crear.</span>
        </div>
      </footer>
    </>
  );
}
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const status = isRouteErrorResponse(error) ? error.status : 500;
  return (
    <main id="main" className="simple-page">
      <p className="eyebrow">PLIEGO / {status}</p>
      <h1>
        {status === 404
          ? "No encontramos esta página"
          : "No pudimos completar la operación"}
      </h1>
      <p>
        {status === 404
          ? "El proyecto no existe o no pertenece a tu cuenta."
          : "Comprueba tu conexión. Si tu sesión venció, vuelve a iniciar sesión. Tus imágenes permanecen en tu dispositivo."}
      </p>
      <Link className="btn btn-primary" to="/">
        Volver al inicio
      </Link>
    </main>
  );
}
