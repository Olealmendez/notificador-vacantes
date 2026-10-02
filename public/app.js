(function () {
  'use strict';

  var BASE = (window.CONFIG && window.CONFIG.API ? window.CONFIG.API : '').replace(/\/$/, '');

  function api(ruta) {
    return BASE + ruta;
  }

  var form = document.getElementById('formulario');
  var desplegable = document.getElementById('especialidad');
  var ayudaEsp = document.getElementById('ayuda-esp');
  var campoEmail = document.getElementById('email');
  var boton = document.getElementById('enviar');
  var aviso = document.getElementById('aviso');

  function mostrarAviso(texto, tipo) {
    aviso.textContent = texto;
    aviso.className = 'aviso ' + tipo;
    aviso.hidden = false;
  }

  function cargarEspecialidades() {
    return fetch(api('/api/especialidades'))
      .then(function (r) {
        return r.json();
      })
      .then(function (datos) {
        if (!datos.ok || !datos.especialidades || !datos.especialidades.length) {
          throw new Error('lista vacia');
        }

        desplegable.innerHTML = '';

        var elegí = document.createElement('option');
        elegí.value = '';
        elegí.textContent = 'Elige una especialidad…';
        elegí.disabled = true;
        elegí.selected = true;
        desplegable.appendChild(elegí);

        var todas = document.createElement('option');
        todas.value = window.CONFIG.TODAS || 'Todas';
        todas.textContent = 'Todas las especialidades';
        desplegable.appendChild(todas);

        datos.especialidades.forEach(function (nombre) {
          var opcion = document.createElement('option');
          opcion.value = nombre;
          opcion.textContent = nombre;
          desplegable.appendChild(opcion);
        });

        ayudaEsp.textContent =
          datos.especialidades.length + ' especialidades disponibles. Cambiala cuando quieras.';
      })
      .catch(function () {
        desplegable.innerHTML = '<option value="">No se pudo cargar la lista</option>';
        ayudaEsp.textContent =
          'No pudimos cargar las especialidades. Revisa tu internet o intenta más tarde.';
      });
  }

  function cargarEstado() {
    var punto = document.getElementById('punto-salud');
    var texto = document.getElementById('texto-salud');

    fetch(api('/api/estado'))
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        if (!d.ok) throw new Error('sin datos');

        punto.className = 'punto ' + d.salud;

        if (!d.ultimaRevision) {
          texto.textContent = 'Todavía no se ha hecho ninguna revisión.';
          return;
        }

        var h = d.haceCuantoHoras;
        var momento =
          h < 1
            ? 'hace menos de una hora'
            : 'hace ' + Math.round(h) + (h < 2 ? ' hora' : ' horas');

        if (d.salud === 'roja') {
          texto.textContent = 'Atención: la última revisión fue ' + momento + '. Puede haber una falla.';
        } else {
          texto.textContent =
            'Última revisión ' + momento + '. ' + d.suscriptoresActivos + ' persona(s) suscrita(s).';
        }
      })
      .catch(function () {
        punto.className = 'punto roja';
        texto.textContent = 'No se pudo comprobar el estado del sistema.';
      });
  }

  form.addEventListener('submit', function (evento) {
    evento.preventDefault();
    aviso.hidden = true;

    var especialidad = desplegable.value;

    if (!especialidad) {
      mostrarAviso('Elegí una especialidad.', 'mal');
      desplegable.focus();
      return;
    }

    var correo = campoEmail.value.trim();

    if (!correo) {
      mostrarAviso('Escribí tu correo electrónico.', 'mal');
      campoEmail.focus();
      return;
    }

    boton.disabled = true;
    boton.textContent = 'Enviando…';

    fetch(api('/api/suscribir'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: correo, especialidades: [especialidad] }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { ok: r.ok, datos: d };
        });
      })
      .then(function (r) {
        if (r.ok && r.datos.ok) {
          mostrarAviso(r.datos.mensaje, 'bien');
          form.reset();
          desplegable.selectedIndex = 0;
        } else {
          mostrarAviso(r.datos.error || 'No se pudo completar la solicitud.', 'mal');
        }
      })
      .catch(function () {
        mostrarAviso('No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.', 'mal');
      })
      .then(function () {
        boton.disabled = false;
        boton.textContent = 'Quiero recibir los avisos';
      });
  });

  cargarEspecialidades();
  cargarEstado();
  setInterval(cargarEstado, 60000);
})();
