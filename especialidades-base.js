const CATALOGO = [
  'Música',
  'Arte Dramático',
  'Arte Visual',
  'Educación Física',
  'Educación Sexual',
  'Trabajo Social',
  'Orientación',
  'Español',
  'Literatura',
  'Inglés',
  'Francés',
  'Italiano',
  'Alemán',
  'Filosofía',
  'Historia',
  'Geografía',
  'Matemáticas',
  'Ciencias Naturales',
  'Biología',
  'Química',
  'Física',
  'Informática Educativa',
  'Desarrollo Web',
  'Contabilidad',
  'Administración',
  'Electrotecnia',
  'Mecánica',
  'Construcción Civil',
  'Agronomía',
  'Enfermería',
  'Nutrición',
  'Turismo',
  'Hotelería',
  'Culinaria',
  'Labores Varias de Oficina',
  'Educación Preescolar',
  'Educación Primaria',
  'Educación Secundaria',
  'Educación Especial',
  'Edición',
  'Fotografía',
  'Teatro',
  'Danza',
  'Música Instrumental',
];

function sinDuplicar(lista) {
  return [
    ...new Set(
      (lista || [])
        .map((e) => String(e).trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, 'es'));
}

function claveComparable(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function juntar(listaPreferida, listaSecundaria) {
  const porClave = new Map();

  for (const nombre of sinDuplicar(listaSecundaria)) {
    porClave.set(claveComparable(nombre), nombre);
  }

  for (const nombre of sinDuplicar(listaPreferida)) {
    const clave = claveComparable(nombre);
    if (!porClave.has(clave)) porClave.set(clave, nombre);
  }

  return [...porClave.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

module.exports = {
  CATALOGO: sinDuplicar(CATALOGO),
  sinDuplicar,
  claveComparable,
  juntar,
};
