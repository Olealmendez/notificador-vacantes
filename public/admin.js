(function () {
  'use strict';

  var CLAVE = 'admin-password';
  var acceso = document.getElementById('acceso');
  var panel = document.getElementById('panel');
  var aviso = document.getElementById('aviso');
  var filas = document.getElementById('filas');
  var resumen = document.getElementById('resumen');
  var dbDias = 90;

  function mostrarAviso(texto, tipo) {
    aviso.textContent = texto;
    aviso.className = 'aviso ' + tipo;
    aviso.hidden = false;
  }

  function clave() {
    return sessionStorage.getItem(CLAVE) || '';
  }

  function pedir(claveAdmin) {
    return fetch('/api/admin', { headers: { 'x-admin-password': claveAdmin } }).then(function (r) {
      return r.json().then(function (d) {
        return { ok: r.ok, datos: d };
      });
    });
  }

  function pintarSuscriptores(lista, resumenDatos, base) {
    var texto =
      resumenDatos.total + ' en total · ' + resumenDatos.activos + ' activos · ' +
      resumenDatos.pendientes + ' pendientes de confirmar.';

    if (base) {
      texto +=
        ' Base de datos: ' + base.usadoMB + ' MB de ' + base.limiteMB +
        ' (' + base.porcentaje + '%). El registro de corridas se borra solo cada ' +
        dbDias + ' días.';
    }
    resumen.textContent = texto;

    filas.innerHTML = '';

    if (lista.length === 0) {
      var vacia = document.createElement('tr');
      var celda = document.createElement('td');
      celda.colSpan = 4;
      celda.className = 'ayuda';
      celda.textContent = 'Todavia no hay nadie suscrito.';
      vacia.appendChild(celda);
      filas.appendChild(vacia);
      return;
    }

    lista.forEach(function (s) {
      var tr = document.createElement('tr');

      var tdCorreo = document.createElement('td');
      tdCorreo.textContent = s.email;

      var tdEstado = document.createElement('td');
      var etiqueta = document.createElement('span');
      etiqueta.className = 'etiqueta ' + s.estado;
      etiqueta.textContent = s.estado;
      tdEstado.appendChild(etiqueta);

      var tdEsp = document.createElement('td');
      tdEsp.className = 'ayuda';
      tdEsp.textContent = (s.especialidades || []).join(', ');

      var tdAcc = document.createElement('td');

      if (s.estado !== 'activo') {
        tdAcc.appendChild(boton('Activar', s.email, 'activo'));
      }
      if (s.estado === 'activo') {
        tdAcc.appendChild(boton('Pausar', s.email, 'pausado'));
      }
      if (s.estado !== 'baja') {
        tdAcc.appendChild(boton('Borrar', s.email, 'baja'));
      }
      if (s.estado === 'activo') {
        tdAcc.appendChild(boton('Avisar lo que ya hay', s.email, 'resumen'));
      }

      tr.appendChild(tdCorreo);
      tr.appendChild(tdEstado);
      tr.appendChild(tdEsp);
      tr.appendChild(tdAcc);
      filas.appendChild(tr);
    });
  }

  function boton(texto, correo, estado) {
    var b = document.createElement('button');
    b.className = 'chico';
    b.textContent = texto;
    b.style.marginRight = '4px';
    b.addEventListener('click', function () {
      if (estado === 'baja' && !window.confirm('Dar de baja a ' + correo + '?')) return;
      if (estado === 'resumen' && !window.confirm('Mandar a ' + correo + ' un correo con las vacantes abiertas que ya hay?')) return;

      b.disabled = true;

      fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': clave() },
        body: JSON.stringify({ email: correo, accion: 'estado', estado: estado }),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function () {
          cargar();
        })
        .catch(function () {
          b.disabled = false;
        });
    });
    return b;
  }

  function cargar() {
    pedir(clave())
      .then(function (r) {
        if (!r.ok) {
          acceso.hidden = false;
          panel.hidden = true;
          return;
        }
        acceso.hidden = true;
        panel.hidden = false;
        pintarSuscriptores(r.datos.suscriptores, r.datos.resumen, r.datos.base);
      })
      .catch(function () {
        mostrarAviso('No se pudo conectar con el servidor.', 'mal');
      });
  }

  function estadoSistema() {
    var punto = document.getElementById('punto-salud');
    var texto = document.getElementById('texto-salud');

    fetch('/api/estado')
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        punto.className = 'punto ' + d.salud;
        if (!d.ultimaRevision) {
          texto.textContent = 'El sistema todavia no ha hecho ninguna revision.';
          return;
        }
        var h = d.haceCuantoHoras;
        var momento = h < 1 ? 'hace menos de una hora' : 'hace ' + Math.round(h) + (h < 2 ? ' hora' : ' horas');
        texto.textContent =
          'Ultima revision ' + momento + ' · ' + d.vacantesRegistradas + ' vacantes en la base · ' +
          d.suscriptoresActivos + ' activos.';
      })
      .catch(function () {
        punto.className = 'punto roja';
        texto.textContent = 'No se pudo comprobar el estado.';
      });
  }

  document.getElementById('entrar').addEventListener('click', function () {
    var valor = document.getElementById('clave').value;

    pedir(valor).then(function (r) {
      if (r.ok && r.datos.ok) {
        sessionStorage.setItem(CLAVE, valor);
        aviso.hidden = true;
        document.getElementById('clave').value = '';
        acceso.hidden = true;
        panel.hidden = false;
        dbDias = r.datos.logSeBorraCadaDias || 90;
        pintarSuscriptores(r.datos.suscriptores, r.datos.resumen, r.datos.base);
        estadoSistema();
      } else {
        mostrarAviso(r.datos.error || 'Contrasena incorrecta.', 'mal');
      }
    });
  });

  document.getElementById('clave').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('entrar').click();
  });

  if (clave()) {
    document.getElementById('clave').value = clave();
    document.getElementById('entrar').click();
  }
})();
