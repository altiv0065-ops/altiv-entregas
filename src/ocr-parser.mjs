// Somente campos necessarios para sugerir roteirizacao; nao reter nome, telefone ou endereco completo.
export function normalizeRoute(raw) {
  const match = String(raw||'').trim().toUpperCase().match(/^(?:DOE|DOI)[-_ ]?(\d{1,2})$/);
  return match ? 'DOE-'+match[1].padStart(2,'0') : null;
}
function clipStreet(line) {
  return line.replace(/(?:\s*,\s*|\s+N[º°.]?\s*)(\d{1,5})(?:\b.*)?$/iu,'').replace(/[;,]+$/,'').trim().slice(0,100);
}
export function parseLabelText(text) {
  const lines=String(text||'').split(/[\n\r]+/).map(x=>x.trim()).filter(Boolean).slice(0,120);
  const routes=[...new Set((String(text||'').toUpperCase().match(/\b(?:DOE|DOI)[-_ ]?\d{1,2}\b/g)||[]).map(normalizeRoute).filter(Boolean))];
  let street='', neighborhood='';
  for (const line of lines) {
    if (!street) {
      const m=line.match(/\b((?:RUA|R\.|AVENIDA|AV\.|TRAVESSA|ALAMEDA|ESTRADA)\s+[\p{L}\p{N} .'-]{3,95})/iu);
      if(m) street=clipStreet(m[1]);
    }
    if (!neighborhood) {
      const m=line.match(/\b(?:BAIRRO|BAIRRO\/DISTRITO)\s*[:\-]\s*([\p{L}\p{N} .'-]{2,75})/iu);
      if(m) neighborhood=m[1].trim().slice(0,80);
    }
  }
  // Nao inferir endereco ou destino somente pela presenca de um codigo DOE.
  return {street,neighborhood,routes};
}
