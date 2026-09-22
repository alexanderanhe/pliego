import { Link, useNavigate } from "react-router";
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  ScanLine,
  Printer,
  MoveUpRight,
  Check,
} from "lucide-react";
import { UploadArea } from "../components/upload";
import { draft } from "../features/poster/draft";
export default function Home() {
  const navigate = useNavigate();
  return (
    <main id="main">
      <section className="hero page-width">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" /> DEL ARCHIVO A TU PARED
          </div>
          <h1>
            Tus ideas.
            <br />A lo{" "}
            <span>
              grande
              <svg viewBox="0 0 280 15" aria-hidden="true">
                <path d="M3 10Q135 -3 276 8" />
              </svg>
            </span>
            .
          </h1>
          <p>
            Convierte cualquier imagen en un póster.
            <br className="desktop-break" /> Imprime en hojas normales, une las
            piezas
            <br className="desktop-break" /> y dale espacio a lo que te inspira.
          </p>
          <Link to="/editor" className="btn btn-primary hero-cta">
            Crear mi póster <ArrowRight size={19} />
          </Link>
          <div className="hero-benefits">
            <span>
              <Check size={15} /> Gratis para empezar
            </span>
            <span>
              <Check size={15} /> Sin instalar nada
            </span>
          </div>
        </div>
        <div className="hero-art">
          <div className="art-note">
            <span>Una imagen. Muchas posibilidades.</span>
            <MoveUpRight size={27} />
          </div>
          <div className="poster-art">
            <img
              src="/landscape.svg"
              alt="Ilustración de montañas dividida en seis hojas para formar un póster"
            />
            <div className="art-grid">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <span className="art-label label-top">A1</span>
            <span className="art-label label-bottom">C2</span>
          </div>
          <div className="art-sticker">
            <Printer size={20} />
            <div>
              Tu impresora de siempre.
              <br />
              <strong>Un resultado más grande.</strong>
            </div>
          </div>
          <span className="art-measure">TÚ PONES EL LÍMITE ↗</span>
        </div>
      </section>
      <section className="start-section page-width">
        <div className="section-heading">
          <div>
            <p className="eyebrow">DA EL PRIMER PASO</p>
            <h2>¿Qué vas a poner en tu pared?</h2>
          </div>
          <span>Una foto, una ilustración, una gran idea.</span>
        </div>
        <UploadArea
          onFile={(file) => {
            draft.file = file;
            navigate("/editor");
          }}
        />
        <div className="privacy-note">
          <ShieldCheck size={16} />
          <span>
            Tu imagen es tuya. Se procesa en tu navegador y no se sube a
            nuestros servidores.
          </span>
        </div>
      </section>
      <section className="how-section page-width">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ASÍ DE SENCILLO</p>
            <h2>De pequeño archivo a gran póster.</h2>
          </div>
          <Link to="/calibration">
            ¿Primera vez imprimiendo? <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="how-grid">
          {[
            {
              n: "01",
              icon: <UploadAreaIcon />,
              title: "Elige tu imagen",
              text: "Ese viaje, tu ilustración favorita o algo que acabas de crear.",
            },
            {
              n: "02",
              icon: <ScanLine size={27} />,
              title: "Dale la medida perfecta",
              text: "Elige el papel y el tamaño. Revisa cada hoja antes de imprimir.",
            },
            {
              n: "03",
              icon: <Printer size={27} />,
              title: "Imprime. Une. Disfruta.",
              text: "Descarga tu PDF, imprime al 100 % y monta tu nueva obra.",
            },
          ].map((s) => (
            <article key={s.n}>
              <div className="how-top">
                <span>{s.n}</span>
                {s.icon}
              </div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="bottom-banner page-width">
        <div>
          <h2>Grandes ideas, medidas exactas.</h2>
          <p>Márgenes, solapamientos y guías para que cada pieza encaje.</p>
        </div>
        <Link to="/editor" className="btn btn-secondary">
          Vamos a crear <ArrowRight size={17} />
        </Link>
      </section>
    </main>
  );
}
function UploadAreaIcon() {
  return <ArrowUpRight size={27} />;
}
