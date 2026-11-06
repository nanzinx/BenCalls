// Copiado do BenHermes (src/utils/calendario.ts (só normalizarNome), commit 3dc7b7a) por scripts/sincronizar-benhermes.mjs.
// Não edite aqui: mude no BenHermes e rode o script de novo, para as regras continuarem iguais nos dois.

export const normalizarNome = (texto: unknown): string => {
  return String(texto ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
};
