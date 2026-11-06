// "vitest" mínimo sobre o node:test, só para rodar aqui os testes copiados do BenHermes.
// Cobre os matchers que eles usam: toBe, toEqual, toBeNull, toHaveLength, toContain, toMatch,
// toMatchObject e toThrow (com e sem .not), mais expect.any e expect.objectContaining.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export { describe, it };

// Comparadores "qualquer coisa do tipo X" e "objeto que contém Y".
const ASSIM = Symbol('assimetrico');
interface Assimetrico { [ASSIM]: (v: unknown) => boolean }
const ehAssim = (v: unknown): v is Assimetrico => !!v && typeof v === 'object' && ASSIM in v;

function iguais(a: unknown, b: unknown): boolean {
  if (ehAssim(b)) return b[ASSIM](a);
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => iguais(x, b[i]));
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  return ka.length === kb.length && kb.every((k) => iguais((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

function contem(real: unknown, esperado: unknown): boolean {
  if (ehAssim(esperado)) return esperado[ASSIM](real);
  if (esperado === null || typeof esperado !== 'object') return Object.is(real, esperado);
  if (real === null || typeof real !== 'object') return false;
  if (Array.isArray(esperado)) {
    return Array.isArray(real) && real.length === esperado.length && esperado.every((e, i) => contem(real[i], e));
  }
  return Object.entries(esperado as Record<string, unknown>).every(([k, v]) => contem((real as Record<string, unknown>)[k], v));
}

// JSON.stringify perde undefined; o toEqual do vitest ignora chaves com undefined, o deepStrictEqual não.
const semUndefined = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(semUndefined);
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, semUndefined(x)]));
  }
  return v;
};

function matchers(real: unknown, negar: boolean) {
  const checar = (ok: boolean, msg: string) => assert.ok(negar ? !ok : ok, negar ? `não deveria: ${msg}` : msg);
  return {
    toBe: (e: unknown) => checar(Object.is(real, e), `${String(real)} === ${String(e)}`),
    toEqual: (e: unknown) => {
      if (!negar && !iguais(real, e)) assert.deepStrictEqual(semUndefined(real), semUndefined(e)); // mostra a diferença
      checar(iguais(real, e), 'objetos iguais');
    },
    toBeNull: () => checar(real === null, `${String(real)} é null`),
    toHaveLength: (n: number) => checar((real as { length: number })?.length === n, `tamanho ${(real as { length: number })?.length} = ${n}`),
    toContain: (e: unknown) => checar(
      typeof real === 'string' ? real.includes(String(e)) : Array.isArray(real) && real.some((x) => Object.is(x, e)),
      `contém ${String(e)}`
    ),
    toMatch: (re: RegExp | string) => checar(typeof re === 'string' ? String(real).includes(re) : re.test(String(real)), `combina com ${String(re)}`),
    toMatchObject: (e: unknown) => checar(contem(real, e), `contém o objeto ${JSON.stringify(e)}`),
    toThrow: (msg?: string | RegExp) => {
      let erro: unknown = null;
      try { (real as () => unknown)(); } catch (x) { erro = x; }
      const texto = erro instanceof Error ? erro.message : String(erro);
      const ok = erro !== null && (msg === undefined || (typeof msg === 'string' ? texto.includes(msg) : msg.test(texto)));
      checar(ok, `lança ${msg ? String(msg) : 'erro'}`);
    }
  };
}

export function expect(real: unknown) {
  return { ...matchers(real, false), not: matchers(real, true) };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
expect.any = (tipo: any): any => ({
  [ASSIM]: (v: unknown) => (tipo === Array ? Array.isArray(v) : tipo === String ? typeof v === 'string' : tipo === Number ? typeof v === 'number' : v instanceof tipo)
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
expect.objectContaining = (obj: object): any => ({ [ASSIM]: (v: unknown) => contem(v, obj) });
