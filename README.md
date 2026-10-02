# Avisos de vacantes del MEP

Revisa el portal de vacantes del Ministerio de Educación Pública de Costa Rica
y manda un correo cuando aparece una vacante de la especialidad que te interesa.

Funciona solo en la nube: revisa 15 veces al día, de lunes a viernes, de 7:00 a.
m. a 9:00 p. m. (hora de Costa Rica). No hace falta que nadie tenga la
computadora encendida.

También se puede ejecutar a mano con doble clic, por si se quiere revisar en
el momento.

---

## Cómo se usa

### Por el sitio web

1. Abrís la dirección del sitio y eliges tu especialidad en el desplegable.
2. Ponés tu correo.
3. Te llega un correo de confirmación. Lo abrís, presionas el botón y ya estás
   suscrito.

Nadie recibe avisos hasta confirmar su correo. Cada persona puede darse de baja
con el enlace que viene en cada correo.

Administrar las suscripciones (ver quién está, pausar, dar de baja) se hace en
`/admin.html` con la contraseña de administración.

### Desde la computadora

Doble clic en `BuscarVacantes.bat`. Espera unos 10 segundos y te dice si salió
bien. Sirve para revisar en el momento o para probar cambios.

---

## Qué hace, en orden

1. Abre la página del MEP con un navegador sin ventana.
2. Recorre todas las direcciones regionales que aparezcan en el desplegable
   (el MEP tiene 27, pero solo muestra las que tienen vacantes, así que pueden
   ser entre 1 y 27).
3. De todas las vacantes se queda con las de la especialidad pedida.
4. Compara con lo que ya avisó y manda correo solo por lo nuevo.
5. Guarda todo en MongoDB Atlas, para no repetir avisos.

Dos detalles que no son evidentes y conviene conocer:

- **Confirma que leyó la región correcta.** La página del MEP a veces sigue
  mostrando los datos de la región anterior mientras carga la siguiente. Un
  programa ingenuo copiaría esos datos y avisaría de vacantes que no son de esa
  región, o se saltaría la región entera sin avisar. Este lo nota, lo descarta y
  la vuelve a leer. Por eso a veces verás el mensaje "Reintento 2/3".
- **Nunca dice "todo limpio" si no revisó todo.** Si una región quedó sin
  revisar, avisa con un letrero y lista cuáles. Un "no hay vacantes nuevas"
  siempre significa que sí revisó todas.

---

## Configuración

Todo se controla con variables de entorno.

| Variable | Para qué |
|---|---|
| `MONGODB_URI` | Conexión a MongoDB Atlas |
| `EMAIL_USER` | El Gmail que manda los avisos |
| `EMAIL_PASS` | Contraseña de aplicación de Google |
| `APP_SECRET` | Firma los enlaces de baja. **Tiene que ser el mismo valor en Vercel y en GitHub** |
| `ADMIN_PASSWORD` | Contraseña del panel de administración |
| `EMAIL_TO` | Destinatarios cuando se ejecuta a mano (se puede separar con comas) |
| `ESPECIALIDAD_BUSCADA` | Palabra que se busca. Por defecto `Música` |
| `TARGET_URL` | La página que se revisa |
| `APP_URL` | Opcional. Solo si cambia el dominio del sitio |

Los ajustes finos (tiempos de espera, reintentos, cuántas specialties se guardan,
cada cuánto se borra el registro de corridas) tienen valores por defecto
razonables. No hace falta tocarlos.

### Sobre la contraseña de Google

Gmail no permite usar la contraseña normal para enviar correos automáticamente.
Se necesita una **contraseña de aplicación**: en
[myaccount.google.com](https://myaccount.google.com) → Seguridad → Verificación
en dos pasos → Contraseñas de aplicación. Son 16 caracteres con espacios en el
medio.

---

## Dónde vive cada cosa

| Pieza | Dónde está |
|---|---|
| Sitio y API | Vercel (plan gratuito, sin tarjeta) |
| Base de datos | MongoDB Atlas, plan gratuito de 512 MB |
| Revisiones automáticas | GitHub Actions |
| Código | Este repositorio, público |

El repositorio es público a propósito: con repositorios privados, GitHub no
activa los horarios automáticos en cuentas gratuitas. **Por eso `.env` nunca se
sube** y el `.gitignore` lo impide.

### Desplegar

El proyecto ya está en Vercel. Para cambiar algo basta con subir el cambio al
repositorio: Vercel y GitHub Actions lo toman automáticamente.

### Configurar las variables en Vercel

Settings → Environment Variables. Se agregan una por una y se redeploya.
Ojo: las mayúsculas y minúsculas importan.

---

## Los archivos

| Archivo | Qué hace |
|---|---|
| `index.js` | Orquestador para cuando se ejecuta a mano |
| `nube.js` | Orquestador para las revisiones automáticas |
| `scraper.js` | Abre la página del MEP y lee las vacantes |
| `db.js` | Lee y escribe en MongoDB Atlas |
| `mailer.js` | Arma y manda los correos |
| `storage.js` | Memoria local, para el uso manual |
| `tokens.js` | Genera y valida los tokens de los enlaces |
| `seguridad.js` | Oculta secretos antes de escribirlos en el registro |
| `especialidades-base.js` | Catálogo fijo de especialidades de enseñanza |
| `api/` | Los endpoints que usa el sitio |
| `public/` | Los archivos que ve el navegador |
| `tests/` | Las pruebas |
| `scripts/` | Utilidades de desarrollo |
| `BuscarVacantes.bat` | Doble clic para ejecutar a mano |

---

## Para desarrollar

```
npm install          # instala dependencias
npm start            # ejecuta a mano (lee el portal de verdad)
npm run start:nube   # ejecuta como lo haría la nube
npm test             # corre las 16 pruebas
npm run web          # levanta el sitio en local: http://127.0.0.1:4788
```

Para probar sin tocar el sitio real, `scripts/mock-mep.js` levanta una copia
local del portal:

```
node scripts\mock-mep.js 27          # 27 regiones
node scripts\mock-mep.js 1 vacias    # 1 región, varias sin resultados
node scripts\mock-mep.js 27 paginas  # con paginación
```

---

## Seguridad

- **`.env` no se publica.** Contiene la contraseña de Google y la de Atlas. Hay
  un `.gitignore` que lo bloquea, y se verificó que ninguna de las revisiones del
  repositorio lo contenga.
- **Los secretos no van al registro.** Los logs de GitHub Actions son públicos
  en un repositorio público, así que antes de imprimir cualquier error se ocultan
  contraseñas, connection strings y claves de API (`seguridad.js`).
- **Nadie recibe avisos sin confirmar su correo.** Evita que alguien escriba el
  correo de un tercero y le haga llegar avisos.
- **Los enlaces de baja están firmados** y solo funcionan para su propia
  dirección.
- **Hay límites de envío.** El formulario público no puede usarse para inundar
  la bandeja de alguien ni para agotar la cuota de Gmail.
- **Las variables de entorno en Vercel** se pueden ver desde el panel, así que
  quien tenga acceso a esa cuenta también tiene acceso a las contraseñas.
- **MongoDB Atlas está abierto a internet** (`0.0.0.0/0`) porque GitHub cambia
  de dirección IP en cada corrida y no publica las suyas. La protección es la
  contraseña, así que conviene que sea larga.

---

## Problemas frecuentes

| Lo que ves | Qué pasa | Qué hacer |
|---|---|---|
| `No hay vacantes nuevas` | No se publicó nada de esa especialidad | Nada |
| `Reintento 2/3` | Se leyó una región antes de tiempo y la relee | Nada, es normal |
| `ATENCIÓN: n regiones NO se pudieron revisar` | Alguna región se trabó | Volvé a ejecutar |
| `Faltan variables en el .env` | Falta configuración | Completá el `.env` |
| `535 Authentication credentials` | Google rechazó el correo | Verificá la contraseña de aplicación |
| `bad auth : authentication failed` | Atlas rechazó la contraseña | Verificá `MONGODB_URI` en Vercel y en GitHub |
| `FALLO al enviar el correo` | No se pudo enviar | El historial no se guardó, se reintenta solo |
| `vistos.json está vacío o dañado` | Se interrumpió el guardado | Se empieza de cero, se avisa de todo otra vez |

### Quiero volver a recibir una vacante que ya me avisaron

Borrá `vistos.json` y volvé a ejecutar `BuscarVacantes.bat`. Si no encuentra
memoria, te avisa de todo lo que haya en ese momento y vuelve a guardar la lista.

---

## Cuánto le cabe a la base de datos

El plan gratuito de Atlas da 512 MB. El sistema usa menos de 1 MB y crece unos
1 MB al año. No hace falta migrar nada. El registro de corridas se borra solo a
los 90 días; las vacantes no se borran nunca porque son la memoria que evita
avisar dos veces lo mismo.