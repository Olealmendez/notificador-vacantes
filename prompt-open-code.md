# Contexto del Proyecto: Notificador de Vacantes MEP (Especialidad Música)

## Rol del Asistente
Eres un desarrollador backend Senior experto en Node.js, Puppeteer y automatización. Tu objetivo es ayudarme a finalizar este proyecto. Debes leer los archivos existentes en el directorio antes de sobrescribir nada, entender el estado actual y continuar con las tareas pendientes.

## Objetivo del Sistema
Un script automatizado que visite el portal de vacantes (https://apps.mep.go.cr/formulario), itere por todas las Direcciones Regionales en el menú desplegable, extraiga la tabla de resultados, filtre únicamente las vacantes donde la especialidad contenga la palabra "Música", y envíe un reporte por correo electrónico usando Nodemailer. Solo debe notificar vacantes nuevas (comparando con un historial local).

## Estado Actual del Proyecto (Lo que ya está hecho)
1. Dependencias instaladas (`puppeteer`, `nodemailer`, `dotenv`).
2. Archivo `.env` configurado con `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_TO` y `TARGET_URL`.
3. Archivo `storage.js` finalizado (contiene lógica con `fs/promises` para leer y escribir en `vistos.json`).
4. Archivo `scraper.js` iniciado, pero incompleto.

## Tareas Pendientes (Ejecútalas en este orden)

### Tarea 1: Finalizar `scraper.js`
Revisa el código actual en `scraper.js` y complétalo para que cumpla estrictamente este flujo:
- Iniciar Puppeteer de forma invisible (*headless*).
- Ir a la `TARGET_URL`.
- Encontrar el elemento `<select>` correspondiente a "Dirección Regional".
- Extraer todas las opciones (`<option>`) excluyendo la opción por defecto.
- Crear un bucle `for...of` que seleccione cada región una por una, espere a que la tabla HTML se actualice, y lea las filas (`<tr>`).
- Extraer los datos (Región, Centro Educativo, Especialidad, Lecciones).
- **Filtro vital:** Guardar solo los objetos donde la `Especialidad` incluya la palabra "Música" (ignorando mayúsculas/minúsculas).
- Generar un `id` único para cada registro (ej. concatenando Región + Centro + Especialidad) para facilitar la deduplicación.
- Retornar el array consolidado de todas las regiones.

### Tarea 2: Crear `mailer.js`
Crea este módulo desde cero con `nodemailer`.
- Debe exportar la función `enviarAlerta(vacantesNuevas)`.
- Configura el transporter para usar el servicio de Gmail con las variables de entorno.
- Genera un cuerpo de correo en HTML limpio y estructurado (usando una tabla o lista) para mostrar los detalles de las vacantes musicales encontradas.
- Si el array `vacantesNuevas` está vacío, la función debe retornar sin hacer nada.

### Tarea 3: Crear `index.js` (El Orquestador)
Crea el punto de entrada principal que una todos los módulos.
- Importa `dotenv`, el scraper, el storage y el mailer.
- Ejecuta `buscarVacantes()`.
- Lee el historial con `obtenerVacantesVistas()`.
- Filtra el array de vacantes obtenidas para quedarse SOLO con aquellas cuyo `id` no exista en el historial.
- Si hay nuevas, invoca `enviarAlerta(nuevas)`.
- Finalmente, une las vacantes nuevas con el historial y guárdalas usando `guardarVacantesVistas()`.
- Añade `console.log` en cada paso para poder monitorear el flujo en la terminal.

## Reglas de Ejecución
- No borres código que ya funciona.
- Si necesitas que yo (el usuario) inspeccione algún selector HTML de la página (id del select, clases de la tabla), dímelo explícitamente para que yo te pase el fragmento de HTML.
- Escribe código modular, con manejo de errores (`try/catch`) para evitar que el script colapse si la página del MEP tarda en cargar.