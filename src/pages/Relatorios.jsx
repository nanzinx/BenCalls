import { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { Download, Printer, Ticket, Sparkles, Timer, Target, RotateCcw, UserX } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { baiaCodigo, nomeUser } from '../store/selectors.js';
import { minutosConsumidos, ABERTOS } from '../lib/rules.js';
import { DIA, duracao, dataCurta, pad } from '../lib/format.js';
import { baixarCsv } from '../lib/csv.js';
import { PageHead, Kpi, Pills } from '../components/ui.jsx';

// Duas séries validadas (slots 1 e 2 da paleta categórica de referência).
const S1 = '#2a78d6';
const S2 = '#eb6834';

function Tip({ active, payload, label, sufixo = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card" style={{ padding: '8px 10px', fontSize: 12.5 }}>
      <b>{label}</b>
      {payload.map((p) => <div key={p.dataKey} className="row" style={{ gap: 6 }}><span className="dot" style={{ background: p.color }} />{p.name}: <b>{p.value}{sufixo}</b></div>)}
    </div>
  );
}

function BarrasH({ dados, cor = S1, sufixo = '', nome = 'Chamados', altura }) {
  const h = altura || Math.max(160, dados.length * 34 + 30);
  return (
    <div style={{ width: '100%', height: h }}>
      <ResponsiveContainer>
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 4 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 12, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: 'var(--surface-3)' }} content={<Tip sufixo={sufixo} />} />
          <Bar isAnimationActive={false} dataKey="valor" name={nome} fill={cor} radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: 'right', fontSize: 11, fill: 'var(--text-2)', formatter: (v) => `${v}${sufixo}` }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Painel({ titulo, desc, children, onCsv }) {
  return (
    <section className="card stack-sm">
      <div className="row-between">
        <div><div className="card-title">{titulo}</div>{desc && <div className="tiny muted">{desc}</div>}</div>
        {onCsv && <button type="button" className="btn btn-sm btn-ghost no-print" onClick={onCsv} aria-label={`Exportar ${titulo} em CSV`}><Download size={14} /> CSV</button>}
      </div>
      {children}
    </section>
  );
}

const top = (m, n = 6) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([nome, valor]) => ({ nome, valor }));

export default function Relatorios() {
  const { st, agora } = useStore();
  const [dias, setDias] = useState(30);

  const r = useMemo(() => {
    const ini = agora - dias * DIA;
    const cs = st.chamados.filter((c) => c.criadoEm >= ini);
    const concl = cs.filter((c) => c.solucao && c.status === 'Concluído');
    const tempos = concl.map((c) => (c.solucao.at - c.criadoEm) / 60000);
    const slaOk = concl.filter((c) => minutosConsumidos(c.hist.filter((h) => h.at <= c.solucao.at), c.solucao.at) <= c.slaMin).length;
    const tri = st.triagensResolvidas.filter((t) => t.at >= ini);
    const comTriagem = cs.filter((c) => c.triagem.length > 0);
    const porCat = {}; const porEquipe = {}; const porBaia = {}; const causas = {}; const parado = {}; const porSup = {};
    cs.forEach((c) => {
      porCat[c.categoria] = (porCat[c.categoria] || 0) + 1;
      if (c.layoutId) {
        porEquipe[c.layoutId] = (porEquipe[c.layoutId] || 0) + 1;
        const b = baiaCodigo(st, c.layoutId, c.pos);
        porBaia[b] = (porBaia[b] || 0) + 1;
      }
      const sup = nomeUser(st, c.remetenteId);
      porSup[sup] = (porSup[sup] || 0) + 1;
      if (c.solucao?.causa && c.solucao.causa !== 'Sem dano físico') causas[c.solucao.causa] = (causas[c.solucao.causa] || 0) + 1;
      if (c.operadorParado && c.layoutId) {
        const fim = c.solucao?.at || (ABERTOS.includes(c.status) ? agora : c.hist[c.hist.length - 1].at);
        parado[c.layoutId] = (parado[c.layoutId] || 0) + Math.round((fim - c.criadoEm) / 60000);
      }
    });
    // triagem por situação: % resolvido sem abrir
    const triSit = {};
    tri.forEach((t) => { triSit[t.situacao] ||= { r: 0, a: 0 }; triSit[t.situacao].r++; });
    comTriagem.forEach((c) => { triSit[c.situacao] ||= { r: 0, a: 0 }; triSit[c.situacao].a++; });
    const triagemPct = Object.entries(triSit).filter(([, v]) => v.r + v.a >= 3).map(([nome, v]) => ({ nome, valor: Math.round((v.r / (v.r + v.a)) * 100), r: v.r, a: v.a })).sort((a, b) => b.valor - a.valor).slice(0, 7);
    // série diária
    const serie = [];
    const nDias = Math.min(dias, 30);
    for (let i = nDias - 1; i >= 0; i--) {
      const d0 = new Date(agora - i * DIA); d0.setHours(0, 0, 0, 0);
      const d1 = d0.getTime() + DIA;
      serie.push({
        dia: `${pad(d0.getDate())}/${pad(d0.getMonth() + 1)}`,
        abertos: st.chamados.filter((c) => c.criadoEm >= d0.getTime() && c.criadoEm < d1).length,
        fechados: st.chamados.filter((c) => c.hist.some((h) => ['Concluído', 'Negado', 'Cancelado'].includes(h.status) && h.at >= d0.getTime() && h.at < d1)).length
      });
    }
    return {
      cs, concl, tri, total: cs.length,
      tempoMedio: tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0,
      slaPct: concl.length ? Math.round((slaOk / concl.length) * 100) : 0,
      foraSla: concl.length - slaOk,
      triPct: tri.length + comTriagem.length ? Math.round((tri.length / (tri.length + comTriagem.length)) * 100) : 0,
      reab: cs.reduce((n, c) => n + (c.reaberturas || 0), 0),
      paradoTotal: Object.values(parado).reduce((a, b) => a + b, 0),
      porCat: top(porCat), porEquipe: top(porEquipe, 8), porBaia: top(porBaia, 6), causas: top(causas), parado: top(parado, 8), porSup: top(porSup, 8),
      triagemPct, serie, dossies: st.dossies.filter((d) => d.criadoEm >= ini).length
    };
  }, [st, agora, dias]);

  const csv = (nome, cab, linhas) => () => baixarCsv(`${nome}-${dias}d`, cab, linhas);

  return (
    <>
      <PageHead title="Dashboard e relatórios" desc={`Últimos ${dias} dias · todos os departamentos · calculado a partir dos chamados registrados. Relatórios automáticos vão para o grupo da gestão.`}>
        <Pills label="Período" value={dias} onChange={setDias} options={[{ value: 7, label: '7 dias' }, { value: 30, label: '30 dias' }, { value: 90, label: '90 dias' }]} />
        <button type="button" className="btn no-print" onClick={() => window.print()}><Printer size={15} /> PDF</button>
        <button type="button" className="btn btn-primary no-print" onClick={csv('chamados', ['Número', 'Aberto em', 'Categoria', 'Tipo', 'Situação', 'Baia', 'Prioridade', 'Status', 'Solicitante', 'Técnico', 'Laudo'],
          r.cs.map((c) => [`#2026-${pad(c.id, 4)}`, dataCurta(c.criadoEm), c.categoria, c.sub, c.situacao, c.layoutId ? baiaCodigo(st, c.layoutId, c.pos) : c.local, c.prioridade, c.status, nomeUser(st, c.remetenteId), c.tecnicoId ? nomeUser(st, c.tecnicoId) : '', c.solucao?.causa || '']))}><Download size={15} /> Excel (CSV)</button>
      </PageHead>

      <div className="grid-kpi">
        <Kpi icon={Ticket} label="Chamados no período" valor={r.total} sub={`${r.concl.length} concluídos`} />
        <Kpi icon={Sparkles} label="Resolvidos na triagem" valor={`${r.triPct}%`} sub={`${r.tri.length} problemas sem abrir chamado`} />
        <Kpi icon={Timer} label="Tempo médio de resolução" valor={duracao(r.tempoMedio)} sub="Da abertura à solução registrada" />
        <Kpi icon={Target} label="SLA cumprido" valor={`${r.slaPct}%`} sub={`${r.foraSla} chamados fora do prazo`} destaque={r.slaPct < 85} />
        <Kpi icon={UserX} label="Operador parado" valor={duracao(r.paradoTotal)} sub="Somando todas as baias" />
        <Kpi icon={RotateCcw} label="Reaberturas" valor={r.reab} sub="Voltaram após o fechamento" />
      </div>

      <Painel titulo="Chamados abertos × fechados por dia" desc="Últimos 30 dias no máximo" onCsv={csv('abertos-fechados', ['Dia', 'Abertos', 'Fechados'], r.serie.map((d) => [d.dia, d.abertos, d.fechados]))}>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={r.serie} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<Tip />} cursor={{ stroke: 'var(--border-strong)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--text-2)' }} />
              <Line isAnimationActive={false} type="monotone" dataKey="abertos" name="Abertos" stroke={S1} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} />
              <Line isAnimationActive={false} type="monotone" dataKey="fechados" name="Fechados" stroke={S2} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Painel>

      <div className="grid-2">
        <Painel titulo="Chamados por categoria" onCsv={csv('por-categoria', ['Categoria', 'Chamados'], r.porCat.map((d) => [d.nome, d.valor]))}><BarrasH dados={r.porCat} /></Painel>
        <Painel titulo="Baias críticas" desc="Ranking de baias com mais chamados — revela cabo ruim, porta USB com defeito…" onCsv={csv('baias-criticas', ['Baia', 'Chamados'], r.porBaia.map((d) => [d.nome, d.valor]))}><BarrasH dados={r.porBaia} /></Painel>
        <Painel titulo="Resolvido na triagem, por situação" desc="% de problemas resolvidos sem abrir chamado (mín. 3 ocorrências)" onCsv={csv('triagem', ['Situação', '% resolvido', 'Resolvidos', 'Viraram chamado'], r.triagemPct.map((d) => [d.nome, d.valor, d.r, d.a]))}><BarrasH dados={r.triagemPct} sufixo="%" nome="Resolvido na triagem" /></Painel>
        <Painel titulo="Causa das quebras (laudos)" desc={`${r.dossies} dossiê(s) enviados ao RH no período`} onCsv={csv('causas', ['Causa', 'Quantidade'], r.causas.map((d) => [d.nome, d.valor]))}><BarrasH dados={r.causas} nome="Laudos" /></Painel>
        <Painel titulo="Chamados por equipe" onCsv={csv('por-equipe', ['Equipe', 'Chamados'], r.porEquipe.map((d) => [d.nome, d.valor]))}><BarrasH dados={r.porEquipe} /></Painel>
        <Painel titulo="Operador parado, por equipe" desc="Minutos sem conseguir trabalhar por problema técnico" onCsv={csv('operador-parado', ['Equipe', 'Minutos'], r.parado.map((d) => [d.nome, d.valor]))}><BarrasH dados={r.parado} sufixo=" min" nome="Tempo parado" /></Painel>
      </div>
      <Painel titulo="Chamados por solicitante" onCsv={csv('por-solicitante', ['Solicitante', 'Chamados'], r.porSup.map((d) => [d.nome, d.valor]))}><BarrasH dados={r.porSup} /></Painel>
    </>
  );
}
