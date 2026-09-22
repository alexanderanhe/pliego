export default function Privacy() {
  return (
    <main id="main" className="simple-page prose-page">
      <p className="eyebrow">TU IMAGEN ES TUYA</p>
      <h1>Privacidad</h1>
      <h2>Procesamiento local</h2>
      <p>
        Las imágenes se decodifican y los PDF se generan en tu navegador. No
        enviamos el archivo ni miniaturas al servidor. Los ajustes del borrador
        se conservan durante la sesión de la pestaña; la imagen permanece en
        memoria hasta que la reemplazas o cierras la pestaña.
      </p>
      <h2>Datos de la cuenta</h2>
      <p>
        Al iniciar sesión guardamos tu correo, su verificación, preferencias,
        plan y proyectos en MongoDB. Los proyectos incluyen nombre, dimensiones,
        tipo, peso y huella SHA-256 del archivo original. Esa huella sirve para
        reconocerlo al reabrirlo.
      </p>
      <h2>Correo y seguridad</h2>
      <p>
        Resend procesa tu dirección de correo para enviarte el código. Guardamos
        hashes de códigos y sesiones, nunca sus valores originales. Las cookies
        de sesión son necesarias para iniciar sesión; no usamos cookies
        publicitarias. Registramos eventos técnicos y hashes de identificadores
        para controlar abusos. En desarrollo local únicamente, los correos de
        prueba y sus códigos se muestran en la consola del servidor.
      </p>
      <h2>Conservación y control</h2>
      <p>
        Los códigos vencen en 10 minutos y las sesiones en 30 días. MongoDB
        elimina registros vencidos mediante TTL. Puedes eliminar proyectos,
        cerrar todas tus sesiones y borrar las preferencias locales desde tu
        navegador. La PWA solo almacena recursos públicos y una pantalla
        offline, nunca proyectos ni respuestas de autenticación.
      </p>
      <h2>Antes de un despliegue público</h2>
      <p>
        El operador debe publicar sus datos de contacto y un canal de solicitud
        de acceso o eliminación de cuenta. Esta instalación no incluye todavía
        eliminación automática de la cuenta.
      </p>
    </main>
  );
}
