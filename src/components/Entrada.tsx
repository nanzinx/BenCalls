// Entrada do BenCalls, em ~2,8 s (mesma ideia do BenHeimdall e do BenURA, com a cara do BenCalls):
//  1. o tíquete cai no centro, o check de "resolvido" se desenha e saem ondas do ponto amarelo;
//  2. a logo "expande": o nome BenCalls sai de trás do ícone;
//  3. "Bom dia, Carla" sobe palavra por palavra e os números do perfil entram um a um, contando;
//  4. uma barrinha mostra quanto falta; na saída abre um círculo do centro e a tela entra em cascata.
// Um clique ou uma tecla pula. Aparece uma vez por dia em cada navegador e sempre logo depois do
// login (lib/entrada.ts). Com "reduzir movimento", só esmaece.
import { Fragment, useEffect, useRef, useState } from 'react';
import { Marca } from './Marca.tsx';
import { primeiroNome, saudacao, valorNaContagem } from '../lib/entrada.ts';

const DURACAO_MS = 2800;
const SAIDA_MS = 600;
const CONTAGEM_MS = 650;

export interface Selo {
  valor?: number;
  texto: string;
  tom?: 'ok' | 'alerta' | 'neutro';
}

const movimentoReduzido = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Conta de 0 até `valor`, começando `atrasoMs` depois de montar. */
export function useContagem(valor: number | undefined, atrasoMs = 0, duracaoMs = CONTAGEM_MS): number | undefined {
  const [mostrado, setMostrado] = useState<number | undefined>(valor === undefined ? undefined : 0);
  useEffect(() => {
    if (valor === undefined) return undefined;
    if (movimentoReduzido()) {
      setMostrado(valor);
      return undefined;
    }
    let quadro = 0;
    const id = setTimeout(() => {
      const inicio = performance.now();
      const passo = (t: number) => {
        setMostrado(valorNaContagem(valor, t - inicio, duracaoMs));
        if (t - inicio < duracaoMs) quadro = requestAnimationFrame(passo);
      };
      quadro = requestAnimationFrame(passo);
    }, atrasoMs);
    return () => {
      clearTimeout(id);
      cancelAnimationFrame(quadro);
    };
  }, [valor, atrasoMs, duracaoMs]);
  return mostrado;
}

function SeloAnimado({ selo, atraso }: { selo: Selo; atraso: number }) {
  const n = useContagem(selo.valor, atraso * 1000 + 150);
  return (
    <span className="en-pulo inline-block" style={{ animationDelay: `${atraso}s` }}>
      <span className={`en-selo en-${selo.tom || 'neutro'}`}>
        {selo.tom === 'ok' || selo.tom === 'alerta' ? <span className="en-ponto" aria-hidden="true" /> : null}
        {selo.valor !== undefined && <b>{n}</b>} {selo.texto}
      </span>
    </span>
  );
}

export function Entrada({
  nome,
  sistema,
  subtitulo,
  selos,
  aoSair,
  aoTerminar,
}: {
  nome: string | null;
  sistema: string;
  subtitulo: string;
  selos: Selo[];
  aoSair: () => void;
  aoTerminar: () => void;
}) {
  const [saindo, setSaindo] = useState(false);
  const avisos = useRef({ aoSair, aoTerminar });
  avisos.current = { aoSair, aoTerminar };
  const palavras = `${saudacao()}${nome ? `, ${primeiroNome(nome)}` : ''}`.split(' ');
  const m = /^(Ben)(.+)$/.exec(sistema);

  useEffect(() => {
    if (saindo) {
      avisos.current.aoSair();
      const id = setTimeout(() => avisos.current.aoTerminar(), SAIDA_MS);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setSaindo(true), DURACAO_MS);
    const pular = () => setSaindo(true);
    window.addEventListener('keydown', pular);
    return () => {
      clearTimeout(id);
      window.removeEventListener('keydown', pular);
    };
  }, [saindo]);

  return (
    <div role="status" aria-live="polite" onClick={() => setSaindo(true)} className={`en-fundo${saindo ? ' en-saindo' : ''}`}>
      <div className="en-brilho" aria-hidden="true" />
      <div className="en-brilho en-brilho-2" aria-hidden="true" />
      <div className="en-grade" aria-hidden="true" />
      <div className={`en-centro${saindo ? ' en-expandir' : ''}`}>
        <div className="en-logo">
          <div className="en-icone">
            <span className="en-onda" aria-hidden="true" />
            <span className="en-onda" style={{ animationDelay: '0.55s' }} aria-hidden="true" />
            <span className="en-onda" style={{ animationDelay: '1.1s' }} aria-hidden="true" />
            <Marca tamanho={72} variante="entrada" />
          </div>
          <span className="en-abre">
            <span className="en-palavra">
              <span className="en-nome">{m ? <>{m[1]}<span>{m[2]}</span></> : sistema}</span>
              <span className="en-sub">{subtitulo}</span>
            </span>
          </span>
        </div>
        <p className="en-saudacao" aria-label={palavras.join(' ')}>
          {palavras.map((p, i) => (
            <Fragment key={i}>
              {i > 0 && ' '}
              <span className="en-surgir inline-block" style={{ animationDelay: `${1.05 + i * 0.09}s` }} aria-hidden="true">
                {p}
              </span>
            </Fragment>
          ))}
        </p>
        <div className="en-selos">
          {selos.map((s, i) => (
            <SeloAnimado key={s.texto} selo={s} atraso={1.35 + i * 0.16} />
          ))}
        </div>
      </div>
      <div className={`en-rodape${saindo ? ' en-oculto' : ''}`}>
        <div className="en-trilho">
          <div className="en-progresso" style={{ animationDuration: `${DURACAO_MS}ms` }} />
        </div>
        <span>clique ou aperte uma tecla para pular</span>
      </div>
    </div>
  );
}
