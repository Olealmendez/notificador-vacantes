(function () {
  'use strict';

  var form = document.getElementById('formulario');
  var cajaEsp = document.getElementById('especialidades');
  var ayudaEsp = document.getElementById('ayuda-esp');
  var errorEsp = document.getElementById('error-esp');
  var marcarTodas = document.getElementById('marcar-todas');
  var ninguna = document.getElementById('ninguna');
  var buscador = document.getElementById('buscar');
  var contador = document.getElementById('contador');
  var sinResultados = document.getElementById('sin-resultados');
  var campoEmail = document.getElementById('email');
  var boton = document.getElementById('enviar');
  var aviso = document.getElementById('aviso');

  var todas = [];
  var marcadas = {};
  var visibles = [];

  function sinAcentos(texto) {
    return String(texto == null ? '' : texto)
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase();
  }

  function mostrarAviso(texto, tipo) {
    aviso.textContent = texto;
    aviso.className = 'aviso ' + tipo;
    aviso.hidden = false;
  }

  function elegidas() {
    return todas.filter(function (nombre) {
      return marcadas[nombre];
    });
  }

  function pintar() {
    var filtro = sinAcentos(buscador.value).trim();
    visibles = todas.filter(function (nombre) {
      return !filtro || sinAcentos(nombre).indexOf(filtro) !== -1;
    });

    cajaEsp.innerHTML = '';

    visibles.forEach(function (nombre) {
      var label = document.createElement('label');
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.value = nombre;
      input.checked = Boolean(marcadas[nombre]);
      input.addEventListener('change', function () {
        marcadas[nombre] = input.checked;
        actualizarContador();
      });

      var texto = document.createElement('span');
      texto.textContent = nombre;

      label.appendChild(input);
      label.appendChild(texto);
      cajaEsp.appendChild(label);
    });

    sinResultados.hidden = visibles.length > 0;
    actualizarContador(visibles.length);
  }

  function actualizarContador(visibles) {
    var marcadasN = elegidas().length;
    var total = visibles === undefined ? todas.length : visibles;

    if (marcadasN === 0) {
      contador.textContent = total + ' especialidades en la lista.';
    } else if (marcadasN === 1) {
      contador.textContent = '1 elegida: ' + elegidas()[0] + '.';
    } else {
      contador.textContent = marcadasN + ' elegidas de ' + todas.length + '.';
    }
  }

  function cargarEspecialidades() {
    fetch('/api/especialidades')
      .then(function (r) {
        return r.json();
      })
      .then(function (datos) {
        if (!datos.ok || !datos.especialidades || !datos.especialidades.length) {
          throw new Error('lista vacia');
        }
        todas = datos.especialidades;
        ayudaEsp.textContent =
          'Marca las que te interesan. Puedes escribir arriba para filtrar la lista.';
        marcarTodas.hidden = false;
        ninguna.hidden = false;
        pintar();
      })
      .catch(function () {
        ayudaEsp.textContent = 'No se pudo cargar la lista. Recarga la página e intenta de nuevo.';
      });
  }

  function cargarEstado() {
    var punto = document.getElementById('punto-salud');
    var texto = document.getElementById('texto-salud');

    fetch('/api/estado')
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        if (!d.ok) throw new Error('sin datos');

        punto.className = 'punto ' + d.salud;

        if (!d.ultimaRevision) {
          texto.textContent = 'El sistema todavia no ha hecho ninguna revision.';
          return;
        }

        var h = d.haceCuantoHoras;
        var momento =
          h < 1
            ? 'hace menos de una hora'
            : 'hace ' + Math.round(h) + (h < 2 ? ' hora' : ' horas');

        if (d.salud === 'roja') {
          texto.textContent =
            'Atencion: la ultima revision fue ' + momento + '. Puede haber una falla.';
        } else {
          texto.textContent =
            'Ultima revision ' + momento + '. ' + d.suscriptoresActivos + ' persona(s) suscrita(s).';
        }
      })
      .catch(function () {
        punto.className = 'punto roja';
        texto.textContent = 'No se pudo comprobar el estado del sistema.';
      });
  }

  buscador.addEventListener('input', pintar);

  marcarTodas.addEventListener('click', function () {
    visibles.forEach(function (n) {
      marcadas[n] = true;
    });
    pintar();
  });

  ninguna.addEventListener('click', function () {
    marcadas = {};
    pintar();
  });

  form.addEventListener('submit', function (evento) {
    evento.preventDefault();
    aviso.hidden = true;
    errorEsp.hidden = true;

    var lista = elegidas();

    if (lista.length === 0) {
      errorEsp.hidden = false;
      document.getElementById('especialidades').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (!campoEmail.value.trim()) {
      mostrarAviso('Escribí tu correo electrónico.', 'mal');
      campoEmail.focus();
      return;
    }

    boton.disabled = true;
    boton.textContent = 'Enviando…';

    fetch('/api/suscribir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: campoEmail.value, especialidades: lista }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { ok: r.ok, datos: d };
        });
      })
      .then(function (r) {
        if (r.ok && r.datos.ok) {
          mostrarAviso(r.datos.mensaje, 'bien');
          marcadas = {};
          pintar();
          buscador.value = '';
          pintar();
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
