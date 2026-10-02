# Notificador de Vacantes MEP — Especialidad Música

## Explicarlo en 30 segundos

Este programa revisa solito la página de vacantes del Ministerio de Educación,
busca los puestos de **profesor de Música** y te manda un **correo** cuando aparece
uno nuevo. Si ya te avisó de una vacante, no te la vuelve a mandar.

---

## ¿Qué hace, paso a paso?

Cada vez que se ejecuta, hace exactamente esto:

1. **Abre la página del MEP** como si fuera una persona usando un navegador de verdad.
2. **Recorre una por una todas las direcciones regionales que salgan en el desplegable.**
   El MEP tiene 27 en total, pero en el formulario **solo aparecen las que tienen
   vacantes en ese momento**, así que pueden ser entre 1 y 27. El programa no supone
   ningún número: revisa las que encuentre, las que sean.
3. De cada lista de vacantes, **se queda solo con las de Música**, ignorando mayúsculas y tildes
   (encuentra "Música", "musica" y "MÚSICA" por igual).
4. Compara lo que encontró **contra una lista de memoria** que guarda en `vistos.json`.
5. Si hay algo que **no le había avisado antes**, te manda un correo con el detalle.
6. Anota lo nuevo en `vistos.json` para no repetirte.

```
   Pagina del MEP  -->  N regiones  -->  solo Musica  -->  es nuevo?
   (1 a 27)                                            |
                                              si -------+------ no
                                               |                  |
                                            correo            no pasa nada
                                               |
                                            lo anota
                                       en vistos.json
```

---

## Cómo usarlo

### La forma fácil (solo hacer doble clic)

Hay un acceso directo en el Escritorio llamado **"Buscar Vacantes"**.

1. **Haz doble clic en "Buscar Vacantes".**
2. Se abre una ventana negra. **Espera unos 10 segundos.**
3. Al final dirá `LISTO`. Cierra la ventana presionando cualquier tecla.
4. Revisa tu correo: si hay vacantes nuevas, te llegó un aviso.

Eso es todo. No hay que tocar nada más ni escribir comandos.

> Si la ventana dice `ALGO NO SALIO BIEN`, copia el texto que aparece y
> mándaselo a quien configuró el programa.

> **Nunca muevas ni borres la carpeta `notificador-vacantes`.** El acceso
> corto del escritorio apunta hacia ella. Puedes mover el acceso directo a
> donde quieras, pero la carpeta del programa debe quedarse donde está.

### La forma avanzada (desde la terminal)

1. Presiona `Mayús` + clic derecho en un espacio vacío → **"Abrir en Terminal"**.
2. Escribe:

```
npm start
```

Si aparece `No hay vacantes nuevas. No se envia correo.` es **buena noticia**: significa
que no se publicó ninguna vacante de Música desde la última revisión.

### Lo que hay dentro

```
notificador-vacantes\        <-- esta carpeta NO se mueve
   BuscarVacantes.bat        <-- el programa
   index.js
   scraper.js
   mailer.js
   storage.js
   .env
   vistos.json
   README.md

Escritorio\
   Buscar Vacantes.lnk       <-- esto si se puede mover a donde quieras
```

El acceso directo es como un "marcador": guarda la dirección de la carpeta real.
Si mueves la carpeta, el acceso directo deja de encontrar el programa y avisa con
un mensaje claro en vez de fallar en silencio.

---

## ¿Qué archivos hay y para qué sirven?

| Archivo | Para qué sirve (en sencillo) |
|---|---|
| `index.js` | **El que manda** cuando lo ejecutás a mano. |
| `nube.js` | **El que manda** cuando corre solo en la nube. |
| `scraper.js` | El "robot" que visita la página del MEP y lee las vacantes. |
| `db.js` | Guarda y lee la memoria en MongoDB Atlas. |
| `mailer.js` | Arma el correo y lo manda. |
| `storage.js` | Guarda y lee la memoria de lo ya avisado (cuando corre a mano). |
| `tokens.js` | Fabrica los enlaces de baja de cada persona. |
| `especialidades-base.js` | Catálogo fijo de especialidades de enseñanza. |
| `api/` | La página web y lo que hay detrás. |
| `public/` | Los archivos que se ven en el navegador. |
| `tests/` | Las pruebas que se corren con `npm test`. |
| `BuscarVacantes.bat` | **El programa.** En el Escritorio hay un acceso directo que lo llama. |
| `vistos.json` | **La memoria.** No lo borres, o volverás a recibir avisos ya recibidos. |
| `.env` | **Tus contraseñas.** Oculto y protegido. No se comparte con nadie. |
| `.env.example` | Plantilla que muestra qué datos hay que llenar. Sin datos reales. |
| `scripts/` | Utilidades de desarrollo. `mock-mep.js` levanta un portal falso del MEP para probar sin tocar el sitio real. |

### Quiero volver a recibir una vacante que ya me avisaron

Borra `vistos.json` y ejecuta `BuscarVacantes.bat` otra vez. El programa no encuentra
memoria de lo anterior, así que te avisa de todo lo que haya en ese momento. Después
vuelve a guardar la lista y sigue funcionando normal.

Tiene un detalle a favor: si el archivo se daña (por ejemplo, si se apaga la
computadora justo mientras se guarda), el programa **no se queda trabado**. Lo
detecta, guarda una copia del archivo dañado con otro nombre y empieza de cero,
avisándote en pantalla. Eso significa que volverás a recibir los correos de todo
lo que haya, pero no se pierde nada para siempre.

Por eso `vistos.json` se guarda de forma "atómica": primero se escribe aparte y
después se reemplaza de un solo golpe. Así el archivo viejo nunca queda a medias.

---

## Configuración

Todo se controla desde el archivo `.env`:

| Dato | Qué es |
|---|---|
| `EMAIL_USER` | El Gmail que **manda** las alertas. |
| `EMAIL_PASS` | Contraseña de aplicación de Google (ver más abajo). |
| `EMAIL_TO` | El correo **que recibe** las alertas. |
| `ESPECIALIDAD_BUSCADA` | La palabra que se busca. Ahora es `Música`. |
| `TARGET_URL` | La página que se revisa. |
| `MONGODB_URI` | La conexión a Atlas. Solo si usás la versión en la nube. |
| `MONGO_BD` | Nombre de la base. `notificador` por defecto. |

Los siguientes valores son para ajustes finos. **Casi nunca hay que tocarlos**;
déjalos como están salvo que sepas lo que haces.

| Dato | Qué hace |
|---|---|
| `TIEMPO_MAX_REGION_MS` | Espera máxima por región (60000 = 1 minuto) antes de reintentar. |
| `INTENTOS_POR_REGION` | Cuántas veces reintenta una región que se trabó (3). |
| `ESPERA_ESTABLE_MS` | Cuánto espera para confirmar que la tabla ya no cambia (8000). |
| `ESPERA_VACIA_MS` | Confirmación de que una región está realmente vacía (1200). |
| `MAX_PAGINAS` | Tope de páginas por región, para que no se quede dando vueltas (100). |
| `REGIONES_MAXIMO_ESPERADO` | Solo avisa si aparecieran más de 27 regiones (27). |

### Sobre la contraseña de Google

Gmail **no** permite usar la contraseña normal para estas cosas. Necesita una
**contraseña de aplicación**, que es una clave distinta solo para programas.

Cómo obtenerla:

1. Entra en [myaccount.google.com](https://myaccount.google.com)
2. Activa la **verificación en dos pasos**
3. Ve a **Contraseñas de aplicación**
4. Crea una para "Correo" y copia la clave de 16 letras
5. Pégala en `.env` después de `EMAIL_PASS=` (se ve así: `abcd efgh ijkl mnop`)

> Si crees que esta clave se te fue de las manos, **bórrala de Google y crea otra**.
> Revocar una contraseña de aplicación la anula de inmediato en cualquier lado.

---

## Si algo falla

| Lo que ves | Qué significa | Qué hacer |
|---|---|---|
| `Faltan variables en el archivo .env` | Falta el usuario o la contraseña de Google. | Revisa que `EMAIL_USER` y `EMAIL_PASS` estén llenos. |
| `535 Authentication credentials` | Google rechazó el correo o la contraseña. | Revisa que la contraseña de aplicación siga vigente. |
| `FALLO al enviar el correo` | No se pudo enviar. | **El historial no se guardó a propósito**, así que la próxima vez lo reintenta solo. No borres nada. |
| `Reintento 2/3...` | **Algo normal.** Se leyó una región antes de tiempo y el programa se dio cuenta y volvió a leerla. | Nada. Solo avisa que se está asegurando. |
| `ATENCIÓN: n regiones NO se pudieron revisar` | Alguna región se trabó del todo. | Vuelve a ejecutar `npm start`. Lo que faltó se avisará en esa corrida. |
| `n regiones se leyeron sin poder confirmar` | Se leyó algo, pero no se pudo comprobar que fuera la región correcta. | Vuelve a ejecutar `npm start`. |
| `El desplegable no devolvió ninguna dirección regional` | La página del MEP no cargó o cambió. | Espera unos minutos y vuelve a intentarlo. |
| `[ERROR FATAL]` | Se cayó el programa (pues, internet). | Vuelve a ejecutar `npm start`. |
| `vistos.json está vacío / estaba dañado` | Se interrumpió el guardado. | Nada. Se empieza de cero y volverás a recibir los correos. |
| `No hay vacantes nuevas` | No hay nada nuevo. Todo normal. | Nada que hacer. |

Un detalle importante: si el correo falla, la vacante **no** se marca como vista,
a propósito. Así se reintenta sola en la próxima ejecución y no te la pierdes.
El único costo es que si tu correo está mal configurado, vas a ver el mismo
error una y otra vez.

### El mensaje de "Reintento" aparece seguido

Es lo normal y no significa que algo esté roto. La página del MEP a veces tarda en
cargar una región, y durante ese rato sigue mostrando los datos de la región
anterior. Un programa ingenuo los copiaría y te avisaría de vacantes que no son
de esa región, o se saltaría la región entera sin decir nada. Este lo nota,
descarta lo que leyó, y la vuelve a leer. Por eso a veces verás:

```
[scraper] Regional Educación San Carlos: la tabla seguía mostrando datos de otra región. Reintento 2/3...
[scraper] [16/21] Regional Educación San Carlos -> 3 fila(s), 0 de música.
```

La segunda línea confirma que la leyó bien. Ese chequeo es la razón por la que
puedes confiar en que todas las regiones se revisaron de verdad.

### Si dice "no se pudieron revisar"

Es la diferencia entre **"no hay nada nuevo"** y **"no pude comprobarlo"**, que no
es lo mismo. El programa nunca te va a decir que todo está limpio si le faltó
revisar alguna región: en ese caso avisa con un letrero `!!!!` y te lista cuáles
faltaron. Lo que sí encontró se guarda igual, así que la próxima corrida te avisa
de lo que se le escapó. Nada se pierde.

### Probarlo sin el sitio real

Si quieres ver cómo se comporta sin esperar al MEP, puedes levantar un portal falso:

```
node scripts\mock-mep.js 27 vacias
node scripts\mock-mep.js 1
node scripts\mock-mep.js 27 paginas
```

Levanta una copia de la página en `http://127.0.0.1:4599` con 27, 1 o 3 regiones,
con o sin resultados vacíos, con o sin paginación. Para que el notificador lo
lea, apunta el `.env` a `http://127.0.0.1:4599/` (una **App Password** de prueba
en el correo, para no mandar correos de verdad). Cierra con `Ctrl+C`.

---

## Seguridad

- **`.env` está protegido.** Contiene tu contraseña, y hay un archivo (`.gitignore`)
  que le dice al sistema de versiones de Git que jamás lo suba ni a GitHub ni a
  ningún lado. Verificado: la contraseña solo existe en ese archivo.
- **`.env.example` sí se puede compartir** y trae los datos vacíos, justamente
  para que alguien más configure su copia sin ver tu contraseña.
- **No compartas `.env` ni `vistos.json`.** Si necesitas pasarle el proyecto a
  alguien, pásale todo menos esos dos archivos.
- El programa se conecta a Google por HTTPS cifrado.

---

## La página web

Cualquiera puede suscribirse desde el navegador. **Dos campos: una especialidad
y un correo.** No hay que instalar nada.

1. Abrís la dirección del sitio
2. Elegís la especialidad en el desplegable
3. Ponés tu correo → te llega un correo de confirmación → lo abrís y listo

Nadie recibe nada hasta que confirma su correo. Eso impide que alguien escriba
el correo de otra persona y le haga llegar avisos, y también que se subscan
miles de correos falsos.

El catálogo tiene una parte fija (las especialidades de enseñanza) y otra que se
arma sola con lo que el MEP va publicando. La fija es importante: si solo
usara lo que hay publicado ahora, Música desaparecería justo cuando no hay
vacantes de música y nadie podría suscribirse.

Quien elija **"Todas las especialidades"** recibe absolutamente todo.

### Administrar

En `/admin.html` con la contraseña de administración: ver quién está suscrito,
pausar a alguien o darlo de baja. Cada persona además puede darse de baja sola
con el enlace que viene en cada correo.

---

## Publicarla gratis

Son dos piezas: **la página** y **la API**. La página es un archivo estático y
cualquiera puede alojarla, pero **la API necesita un sitio que ejecute código**
porque guarda las claves de la base de datos. Si la página se publica sola y
habla directamente con MongoDB, la clave queda escrita en el código del
navegador y cualquiera que abra las herramientas del navegador la lee.

Por eso hacen falta los dos. Estos son los caminos, de más simple a más flexible.

### Opción 1 — Todo en Vercel (la más simple)

Un solo servicio, un solo lugar donde poner las claves, y da una dirección
pública lista para compartir.

1. Entrá a [vercel.com](https://vercel.com) con tu cuenta de GitHub
2. **Add New → Project** → importá `notificador-vacantes` → **Deploy**
3. Settings → **Environment Variables** → agregá estas seis:

| Variable | Qué poner | Dónde la sacás |
|---|---|---|
| `MONGODB_URI` | La connection string de Atlas | Atlas → **Database Access** → tu usuario `notificador` → **Connect** → **Drivers** → empieza con `mongodb+srv://` |
| `EMAIL_USER` | Tu Gmail | El mismo que usás en `.env` |
| `EMAIL_PASS` | Tu contraseña de aplicación | myaccount.google.com → Contraseñas de aplicación |
| `ADMIN_PASSWORD` | Una contraseña a tu gusto | Se la inventás vos |
| `APP_SECRET` | La frase que te doy más abajo | Copiala tal cual, con mayúsculas y minúsculas |
| `APP_URL` | **Opcional.** Ver nota | Vercel → tu proyecto → **Domains** |

**Sobre `APP_URL`:** no hace falta ponerla en el primer despliegue. Si está
vacía, el programa usa el dominio de cada visita para armar los enlaces, así
que funcionan igual. Solo ponela si cambias el dominio del sitio más adelante.

**Ojo con los nombres:** en Vercel importan las mayúsculas y minúsculas.
`MONGODB_URI` y `mongodb_uri` no son lo mismo.

4. Redeploy. Listo.

**Sin tarjeta de crédito.** El plan Hobby es $0 permanente. Cada vez que
subís un commit a `main`, Vercel publica solo.

### Opción 2 — La página en GitHub Pages, la API en Vercel

Si preferís que la dirección sea `olealmendez.github.io/notificador-vacantes/`:

1. Hacé la Opción 1 pero **solo** con la API. Anotá la dirección que te da
   Vercel (algo como `https://notificador-vacantes.vercel.app`).
2. En el repo, editá `public/config.js` y poné esa dirección:

   ```js
   window.CONFIG = { API: 'https://notificador-vacantes.vercel.app/', TODAS: 'Todas' };
   ```

3. En el repo: **Settings → Pages** → Source: **Deploy from a branch** →
   rama `main`, carpeta `/ (root)` → Save
4. La página queda en `https://olealmendez.github.io/notificador-vacantes/`

La API ya tiene permiso para responder a ese origen, así que no hay que
configurar nada más. Cada vez que subís un commit, GitHub Pages publica la
página solo.

### Por qué no Render

Se duerme a los 15 minutos de no recibir visitas y tarda **cerca de un minuto**
en despertar, mostrando una pantalla de carga. Para un formulario público donde
entra un maestro después de una hora sin visitas, esa espera es intolerable.
Vercel responde en milisegundos.

### En los dos casos falta lo mismo

Agregá `APP_SECRET` como secreto en **GitHub → Settings → Secrets and variables
→ Actions**, con **el mismo valor** que pusiste en Vercel:

```
1xblpbvkivzbD8LBEG8wSJMAxGOn6Qe1w3Cdu9DIMRw
```

El robot en la nube lo usa para firmar los enlaces de baja. Si los dos valores
no coinciden, los enlaces de los correos salen rotos y nadie se puede dar de
baja. Es lo único que hay que mantener igual en los dos sitios.

## Cuánto le cabe a la base de datos

Atlas en su plan gratuito da **512 MB**. Medido hoy, el sistema usa **0.41 MB**,
o sea el 0.08%.

| Qué crece | Cuánto |
|---|---|
| Registro de corridas (330 al mes) | 61 KB/mes |
| Vacantes nuevas (unas 80 al mes) | 28 KB/mes |
| **Total** | **~1 MB por año** |

Al ritmo actual, el plan gratuito se llenaría en **más de 700 años**. No hace
falta otra base de datos ni migrar nada.

Aun así, el registro de corridas se borra solo a los 90 días gracias a un
índice de expiración de MongoDB, por si el uso creciera. Eso no se nota ni hay
que hacerlo a mano. El panel de administración muestra cuánto se está usando.

Las vacantes **no** se borran: son la memoria que evita avisarte dos veces de lo
mismo. Ocupan 361 bytes cada una.

### Por qué no conviene poner la base dentro de un contenedor gratis

Suena más simple, pero es una mala idea:

- Los contenedores gratuitos de Render (y similares) **no tienen disco
  permanente**. Todo lo que guardes se pierde en cada despliegue y cada vez que
  el servicio se duerme.
- MongoDB necesita unos 256 MB de memoria solo para arrancar, y esos servicios
  dan 512 MB en total contando la aplicación.

O sea: la base se quedaría sin espacio a la primera caída. Atlas no tiene ese
problema y mientras no se pase de 512 MB no te cobra un centavo.

Si algún día hicieran falta más de 512 MB, el salto natural es el plan Flex de
Atlas (desde $8 al mes) o MongoDB en un servidor propio. Hoy no tiene sentido.

### Mirar cómo queda sin publicarlo

```
npm run web
```

Levanta la página en `http://127.0.0.1:4788`. No manda correos de verdad.

## Dejarlo trabajando solo

### Opción 1 — En la nube (recomendada)

El programa se revisa solo, sin necesidad de que tu computadora esté encendida.
Lo hace GitHub Actions: 15 veces al día, de lunes a viernes, de 7:00 a. m. a
9:00 p. m. (hora de Costa Rica).

Para que funcione, el repositorio debe ser **público** (con privado, GitHub no
activa los horarios automáticos en cuentas gratuitas) y tener estos secretos en
**Settings → Secrets and variables → Actions**:

| Secreto | Qué es |
|---|---|
| `MONGODB_URI` | La conexión a MongoDB Atlas |
| `EMAIL_USER` | El Gmail que manda los avisos |
| `EMAIL_PASS` | La contraseña de aplicación de Google |
| `ADMIN_EMAIL` | Tu correo, para avisos de problemas |

Los secretos van cifrados y no se muestran nunca en el código.

Cada corrida queda registrada en la base de datos. Si una falla, el motivo queda
guardado también, para poder verlo desde la web.

> **GitHub desactiva los horarios automáticos si el repositorio pasa 60 días sin
> recibir ningún commit.** Es el único punto débil de esta opción. Cuando se
> llegue a la Etapa 2, la página web mostrará en rojo cuánto tiempo lleva sin
> revisarse, que es la forma de enterarse.

### Opción 2 — En esta computadora (respaldo)

Si prefieres que corra aquí, se puede dejar en el Programador de tareas de
Windows. La computadora debe estar encendida y con tu sesión iniciada.

- **Programa:** `C:\Program Files\nodejs\node.exe`
- **Argumentos:** `<ruta del proyecto>\index.js`
- **Iniciar en:** `<ruta del proyecto>`
- **Repetir cada:** 1 hora, entre las 7:00 a. m. y las 9:00 p. m.

Ojo: para correrlo a mano **nunca** uses el `.bat` desde una tarea programada,
porque tiene un `pause` que la dejaría esperando una tecla para siempre. Usá
`node index.js` directamente.
