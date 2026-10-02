function ocultarSecretos(texto) {
  return String(texto ?? '')
    .replace(/([a-z]{4})[ ]([a-z]{4})[ ]([a-z]{4})[ ]([a-z]{4})/gi, '**** **** **** ****')
    .replace(/(mongodb(?:\+srv)?:\/\/[^:@\s/]+:)([^@\s/]+)(@)/gi, '$1***$3')
    .replace(
      /\b([A-Z][A-Z0-9_]*(?:PASS|SECRET|TOKEN|APIKEY|API_KEY|KEY)[A-Z0-9_]*[ \t]*[:=][ \t]*)([^\s,;)&"']+)/g,
      '$1***',
    )
    .replace(
      /\b((?:[a-z]+[A-Z])*(?:password|passwd|secret|token|apiKey|api_key)[A-Za-z]*[ \t]*[:=][ \t]*)([^\s,;)&"']+)/gi,
      '$1***',
    )
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '***')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '***');
}

function registrar(consola, metodo) {
  return (...partes) => {
    const texto = partes
      .map((p) => (p instanceof Error ? ocultarSecretos(p.stack || p.message) : p))
      .map((p) => (typeof p === 'string' ? ocultarSecretos(p) : p))
      .join(' ');
    consola[metodo](texto);
  };
}

module.exports = { ocultarSecretos, registrar };