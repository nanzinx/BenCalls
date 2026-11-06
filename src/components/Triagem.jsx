import { Check, AlertTriangle, Camera, CheckCircle2 } from 'lucide-react';
import { hhmmss } from '../lib/format.ts';
import { passoOk } from '../lib/rules.ts';

export const MIN_MOTIVO = 10;

/** Lista de passos com "Feito" / "Não foi possível" + motivo obrigatório (RF05/RF07). */
export function PassosTriagem({ passos, regs, setReg }) {
  return (
    <div>
      {passos.map((p, j) => {
        const r = regs[p.key];
        const st = r?.st || '';
        const falta = Math.max(0, MIN_MOTIVO - (r?.motivo || '').trim().length);
        const marcar = (novo) => setReg(p.key, st === novo ? null : { st: novo, at: Date.now(), motivo: r?.motivo || '', texto: p.texto });
        return (
          <div key={p.key} className="tstep">
            <div className="flex flex-wrap justify-between gap-3 items-start">
              <span className="flex gap-2.5 flex-[1_1_240px] items-start flex-nowrap">
                <span className={`box ${st === 'feito' ? 'ok' : st === 'imposs' ? 'imp' : ''}`} aria-hidden="true">{st === 'feito' ? <Check size={14} /> : st === 'imposs' ? '!' : ''}</span>
                <span className="text-[14.5px]"><span className="text-mudo">{j + 1}.</span> {p.texto}</span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" className="pill" aria-pressed={st === 'feito'} onClick={() => marcar('feito')}
                  style={st === 'feito' ? { background: 'rgb(var(--ok-ponto))', borderColor: 'rgb(var(--ok-ponto))', color: '#fff' } : undefined}>Feito</button>
                <button type="button" className="pill" aria-pressed={st === 'imposs'} onClick={() => marcar('imposs')}
                  style={st === 'imposs' ? { background: '#8a5a12', borderColor: '#8a5a12', color: '#fff' } : undefined}>Não foi possível</button>
              </div>
            </div>
            {st === 'imposs' && (
              <label className="field pl-8">Por que não foi possível? (obrigatório)
                <input className="input" value={r.motivo} onChange={(e) => setReg(p.key, { ...r, motivo: e.target.value })} placeholder="Ex.: não há outra baia livre no momento" autoFocus />
                <span className={`hint ${falta ? 'bad' : 'ok'}`}>{falta ? `Faltam ${falta} caracteres` : 'Motivo ok'}</span>
              </label>
            )}
            {r && <span className="text-[11px] text-mudo pl-8">{st === 'feito' ? 'Marcado como feito às ' : 'Marcado como não possível às '}{hhmmss(r.at)}</span>}
          </div>
        );
      })}
    </div>
  );
}

export function progressoTriagem(passos, regs) {
  const feitos = passos.filter((p) => passoOk(regs[p.key], MIN_MOTIVO)).length;
  return { feitos, total: passos.length, falta: passos.length - feitos };
}

export function BarraProgresso({ feitos, total }) {
  if (!total) return null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs"><span className="text-mudo">Triagem</span><b>{feitos} de {total} passos</b></div>
      <div className="progress" role="progressbar" aria-valuenow={feitos} aria-valuemin={0} aria-valuemax={total}><i style={{ width: `${(feitos / total) * 100}%` }} /></div>
    </div>
  );
}

export function AnexoFoto({ nome, onChange, obrigatorio }) {
  return nome ? (
    <div className="flex flex-wrap items-center gap-2">
      <span className="badge b-ok"><CheckCircle2 size={13} /> {nome}</span>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange(null)}>Remover</button>
    </div>
  ) : (
    <label className="btn btn-dashed self-start cursor-pointer">
      <Camera size={16} /> {obrigatorio ? 'Anexar foto (obrigatório)' : 'Anexar print ou foto (opcional)'}
      <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f.name); }} />
    </label>
  );
}

export function AvisoRapido() {
  return (
    <div className="note note-warn" role="note"><AlertTriangle size={16} />
      <div>Os passos estão sendo marcados muito rápido. O horário de cada marcação vai junto com o chamado e o TI recebe um alerta se a triagem parecer não executada.</div>
    </div>
  );
}
