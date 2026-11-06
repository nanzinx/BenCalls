import { useState } from 'react';
import { Save, Upload, RotateCcw, Puzzle, BellRing, Palette, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useStore } from '../store/store.jsx';
import { contraste, nivelContraste, textoSobre } from '../lib/contrast.ts';
import { PageHead, Field, Note, Seg } from '../components/ui.jsx';

const PRESETS = [
  { nome: 'Benconsig', primaria: '#0B3A82', destaque: '#F5B800' },
  { nome: 'Roxo e laranja', primaria: '#5B2A86', destaque: '#F2A541' },
  { nome: 'Verde e lima', primaria: '#14532D', destaque: '#A3E635' },
  { nome: 'Grafite e ciano', primaria: '#1F2937', destaque: '#22D3EE' }
];
import { FONTES as MAPA_FONTES } from '../components/Theme.jsx';
const FONTES = Object.keys(MAPA_FONTES);
const MODULOS = [
  ['termo', 'Termo de responsabilidade', 'Termo digital dos itens da baia para aceite do operador.'],
  ['dossie', 'Dossiê para o RH', 'Laudo “mau uso” gera dossiê com chamado, fotos, ocupante e termo.'],
  ['benhub', 'Integração BenHub', 'Avisos nos grupos do BenHub. Desligado, o mesmo motor envia por e-mail.'],
  ['argus', 'Integração Argus', 'Ocupação das baias pelo login na Argus (fase futura).']
];

function lerImagem(file, max = 400_000) {
  return new Promise((res, rej) => {
    if (file.size > max) return rej(new Error(`Imagem muito grande (máx. ${Math.round(max / 1000)} KB).`));
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function Contraste({ a, b, rotulo }) {
  const r = contraste(a, b);
  const n = nivelContraste(r);
  const I = !n.ok ? XCircle : n.aviso ? AlertTriangle : CheckCircle2;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-2">
      <span className="flex flex-wrap items-center gap-2 text-xs"><span className="py-0.5 px-2 rounded-[6px] font-bold border border-linha" style={{ background: b, color: a }}>Aa</span>{rotulo}</span>
      <span className={`badge badge-sm ${!n.ok ? 'b-bad' : n.aviso ? 'b-warn' : 'b-ok'}`}><I size={12} /> {r.toFixed(2)}:1 · {n.nivel}</span>
    </div>
  );
}

export default function Personalizacao() {
  const { st, actions, toast } = useStore();
  const [aba, setAba] = useState('tema');
  const [t, setT] = useState(st.tema);
  const [erro, setErro] = useState('');
  const set = (patch) => setT({ ...t, ...patch });
  const hexOk = (h) => /^#[0-9a-fA-F]{6}$/.test(h);
  const ilegivel = !nivelContraste(contraste(textoSobre(t.primaria), t.primaria)).ok;
  const mudou = JSON.stringify(t) !== JSON.stringify(st.tema);

  return (
    <>
      <PageHead title="Personalização" desc="Cada empresa cliente personaliza visual, textos e módulos. A assinatura Benconsig (faixa amarela e selo “Desenvolvido por”) é fixa e não pode ser removida (RN10)." />
      <Seg label="Seções" value={aba} onChange={setAba} options={[{ value: 'tema', label: 'Tema', icon: Palette }, { value: 'modulos', label: 'Módulos', icon: Puzzle }, { value: 'canais', label: 'Notificações', icon: BellRing }]} />

      {aba === 'tema' && (
        <div className="split">
          <section className="main card flex flex-col gap-5">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-3">
              <Field label="Nome do sistema"><input className="input" value={t.nomeSistema} onChange={(e) => set({ nomeSistema: e.target.value })} /></Field>
              <Field label="Nome da empresa"><input className="input" value={t.empresa} onChange={(e) => set({ empresa: e.target.value })} /></Field>
              <Field label="Letra do logo (sem imagem)"><input className="input" maxLength={2} value={t.logoTexto} onChange={(e) => set({ logoTexto: e.target.value })} /></Field>
              <div className="field">Logo (imagem)
                <div className="flex flex-wrap items-center gap-2">
                  <label className="btn btn-sm cursor-pointer"><Upload size={14} /> Enviar<input type="file" accept="image/*" className="sr-only" onChange={async (e) => { try { const f = e.target.files?.[0]; if (f) set({ logoImg: await lerImagem(f, 200_000) }); setErro(''); } catch (x) { setErro(x.message); } }} /></label>
                  {t.logoImg && <><img className="w-[34px] h-[34px] rounded-[8px] object-cover" src={t.logoImg} alt="Logo atual" /><button type="button" className="btn btn-sm btn-ghost" onClick={() => set({ logoImg: '' })}>Remover</button></>}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <b className="text-xs">Cores</b>
              <div className="flex flex-wrap items-center gap-1.5">{PRESETS.map((p) => (
                <button key={p.nome} type="button" className="pill" onClick={() => set({ primaria: p.primaria, destaque: p.destaque })}>
                  <span className="dot" style={{ background: p.primaria }} /><span className="dot" style={{ background: p.destaque }} />{p.nome}
                </button>
              ))}</div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-3">
                {[['primaria', 'Cor principal'], ['destaque', 'Cor de destaque']].map(([k, l]) => (
                  <Field key={k} label={l} hint={hexOk(t[k]) ? '' : 'Use o formato #RRGGBB'} hintTone="bad">
                    <span className="flex items-center gap-2 flex-nowrap">
                      <input className="w-12 h-[42px] border-0 bg-transparent p-0" type="color" value={hexOk(t[k]) ? t[k] : '#000000'} onChange={(e) => set({ [k]: e.target.value.toUpperCase() })} aria-label={`${l} (seletor)`} />
                      <input className="input font-mono" value={t[k]} onChange={(e) => set({ [k]: e.target.value })} />
                    </span>
                  </Field>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <b className="text-xs">Validação de contraste (RF37)</b>
              <Contraste a={textoSobre(t.primaria)} b={t.primaria} rotulo="Texto sobre a cor principal (barra, botões)" />
              <Contraste a={t.primaria} b="#FFFFFF" rotulo="Cor principal como texto em fundo branco" />
              <Contraste a={contraste(t.destaque, t.primaria) >= 4.5 ? t.primaria : textoSobre(t.destaque)} b={t.destaque} rotulo="Texto sobre o destaque (selos, foco)" />
              <span className="text-[11px] text-mudo">Quando a cor principal fica ilegível como texto, o sistema escurece automaticamente o tom usado em títulos e links.</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-3">
              <Field label="Fonte"><select className="select" value={t.fonte} onChange={(e) => set({ fonte: e.target.value })}>{FONTES.map((f) => <option key={f}>{f}</option>)}</select></Field>
              <Field label="Frase da tela de login"><input className="input" value={t.loginTitulo} onChange={(e) => set({ loginTitulo: e.target.value })} /></Field>
              <div className="field">Imagem da tela de login
                <div className="flex flex-wrap items-center gap-2">
                  <label className="btn btn-sm cursor-pointer"><Upload size={14} /> Enviar<input type="file" accept="image/*" className="sr-only" onChange={async (e) => { try { const f = e.target.files?.[0]; if (f) set({ loginImg: await lerImagem(f) }); setErro(''); } catch (x) { setErro(x.message); } }} /></label>
                  {t.loginImg && <button type="button" className="btn btn-sm btn-ghost" onClick={() => set({ loginImg: '' })}>Remover</button>}
                </div>
              </div>
              <Field label="Como chamar a “baia”" hint="Ex.: baia, posição, estação"><input className="input" value={t.termos.baia} onChange={(e) => set({ termos: { ...t.termos, baia: e.target.value } })} /></Field>
            </div>
            {erro && <Note tipo="bad">{erro}</Note>}
            {ilegivel && <Note tipo="bad">A cor principal deixa o texto ilegível. Escolha um tom mais escuro ou mais claro.</Note>}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-primary btn-lg" disabled={!mudou || !hexOk(t.primaria) || !hexOk(t.destaque) || ilegivel} onClick={() => { actions.salvarTema({ ...t, primaria: t.primaria.toUpperCase(), destaque: t.destaque.toUpperCase() }); toast('Tema aplicado para todos os usuários desta instalação.'); }}><Save size={16} /> Salvar e aplicar</button>
              <button type="button" className="btn btn-lg" disabled={!mudou} onClick={() => setT(st.tema)}><RotateCcw size={15} /> Descartar</button>
            </div>
          </section>

          <aside className="side flex flex-col gap-3 sticky-lado">
            <section className="card card-pad-0" aria-label="Prévia do tema">
              <div className="py-3 px-3.5 border-b-4 border-[#F5B800] flex items-center gap-2.5" style={{ background: t.primaria, color: textoSobre(t.primaria) }}>
                <span className="logo" style={{ background: t.destaque, color: contraste(t.destaque, t.primaria) >= 4.5 ? t.primaria : textoSobre(t.destaque) }}>{t.logoImg ? <img src={t.logoImg} alt="" /> : t.logoTexto}</span>
                <span className="brand-txt"><b>{t.nomeSistema}</b><span>{t.empresa}</span></span>
              </div>
              <div className="flex flex-col gap-3 p-4" style={{ fontFamily: MAPA_FONTES[t.fonte] || MAPA_FONTES.Inter }}>
                <b className="text-[18px]" style={{ color: contraste(t.primaria, '#fff') >= 4.5 ? t.primaria : undefined }}>Olá, Carla</b>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="btn" style={{ background: t.primaria, color: textoSobre(t.primaria), borderColor: t.primaria }}>Novo chamado</span>
                  <span className="badge" style={{ background: t.destaque, color: contraste(t.destaque, t.primaria) >= 4.5 ? t.primaria : textoSobre(t.destaque) }}>NOVO</span>
                </div>
                <div className="footer-sig"><span>Desenvolvido por</span><span className="sig-chip"><i>B</i><b>BENCONSIG</b></span></div>
              </div>
            </section>
            <Note tipo="info">Fica fixo em todas as versões: faixa amarela nas barras, selo “Desenvolvido por Benconsig” no rodapé e no login, ícones e estrutura das telas, assinatura dos e-mails e PDFs.</Note>
          </aside>
        </div>
      )}

      {aba === 'modulos' && (
        <section className="card flex flex-col gap-3">
          <p className="text-xs text-mudo">Recursos próprios da Benconsig viram módulos opcionais que cada empresa cliente liga ou desliga (RF41).</p>
          {MODULOS.map(([k, nome, desc]) => (
            <div key={k} className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-3">
              <div><b>{nome}</b><div className="text-xs text-mudo">{desc}</div></div>
              <label className="check"><input type="checkbox" role="switch" checked={!!st.modulos[k]} onChange={() => { actions.alternarModulo(k); toast(`${nome} ${st.modulos[k] ? 'desligado' : 'ligado'}.`); }} />{st.modulos[k] ? 'Ligado' : 'Desligado'}</label>
            </div>
          ))}
        </section>
      )}

      {aba === 'canais' && (
        <section className="card card-pad-0 table-wrap">
          <table className="table min-w-[720px]">
            <thead><tr><th>Evento</th><th>Grupo de destino</th><th>Canal</th><th>Ativo</th></tr></thead>
            <tbody>{st.canais.map((c) => (
              <tr key={c.id}>
                <td><b>{c.evento}</b></td>
                <td><input className="input min-h-[36px]" defaultValue={c.grupo} aria-label={`Grupo para ${c.evento}`} onBlur={(e) => e.target.value !== c.grupo && actions.salvarCanal({ ...c, grupo: e.target.value })} /></td>
                <td><select className="select min-h-[36px]" value={c.canal} onChange={(e) => actions.salvarCanal({ ...c, canal: e.target.value })} aria-label={`Canal para ${c.evento}`}>{['BenHub', 'E-mail', 'Microsoft Teams', 'WhatsApp', 'Webhook'].map((x) => <option key={x}>{x}</option>)}</select></td>
                <td><input className="w-[18px] h-[18px] accent-marca" type="checkbox" checked={c.ativo} onChange={(e) => actions.salvarCanal({ ...c, ativo: e.target.checked })} aria-label={`Ativar ${c.evento}`} /></td>
              </tr>
            ))}</tbody>
          </table>
          <div className="text-xs text-mudo p-3">Pendência técnica (§2.5): confirmar como o BenHub recebe mensagens de outro sistema (API, webhook, bot ou e-mail). Até lá, o e-mail fica como canal reserva.</div>
        </section>
      )}
    </>
  );
}
