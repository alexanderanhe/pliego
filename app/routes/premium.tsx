import { Link } from "react-router";
import { Sparkles, Check } from "lucide-react";
export default function Premium() {
  return (
    <main id="main" className="simple-page">
      <span className="auth-icon">
        <Sparkles />
      </span>
      <p className="eyebrow">PREMIUM · PRÓXIMAMENTE</p>
      <h1>Más espacio para crear.</h1>
      <p>
        Estamos preparando herramientas para proyectos aún más grandes. El
        editor y las descargas gratuitas ya están disponibles.
      </p>
      <ul className="feature-list">
        <li>
          <Check />
          Hasta 200 hojas por póster
        </li>
        <li>
          <Check />
          Hasta 100 proyectos guardados
        </li>
        <li>
          <Check />
          Efectos creativos avanzados, en una futura entrega
        </li>
      </ul>
      <p>
        Todavía no ofrecemos suscripciones ni cobramos pagos. Los efectos de
        semitono, almacenamiento de imágenes y exportación ZIP están pendientes
        de desarrollo.
      </p>
      <Link className="btn btn-primary" to="/editor">
        Crear un póster gratis
      </Link>
    </main>
  );
}
