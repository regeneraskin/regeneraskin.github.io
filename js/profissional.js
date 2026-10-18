// Painel da profissional: lista as fichas enviadas e permite acompanhar cada uma.
import { api } from './api.js?v=202610180432';
import { alertas, respostaView } from './render.js?v=202610180432';
import { el, banner, toast, dataHora, dataCurta, hojeISO, uid, diaNoFuso, linkWhatsApp, primeiroNome, linkDaFicha, linkAgendamento } from './util.js?v=202610180432';
import { exigirLogin, barraTopo, modal, painelEnvio, modelosMensagem } from './equipe.js?v=202610180432';

const app = document.getElementById('app');
const STATUS = { nova: 'Nova', vista: 'Vista', arquivada: 'Arquivada' };

let pessoa;
let fichas = [];
let selecionada = null;
const filtro = { texto: '', status: 'ativas', form: '' };

const lista = el('div', { class: 'lista-itens' });
const detalhe = el('section', { class: 'detalhe' });
const painel = el('main', { class: 'painel' });
const selForm = el('select', { class: 'input', 'aria-label': 'Filtrar por questionário', onchange: (e) => { filtro.form = e.target.value; desenharLista(); } });

exigirLogin(app, 'Painel da Profissional', async (p) => {
  pessoa = p;
  const busca = el('input', { class: 'input', type: 'search', placeholder: 'Buscar por nome ou telefone…', oninput: (e) => { filtro.texto = e.target.value; desenharLista(); } });
  const selStatus = el('select', { class: 'input', 'aria-label': 'Filtrar por situação', onchange: (e) => { filtro.status = e.target.value; desenharLista(); } },
    el('option', { value: 'ativas' }, 'Novas e vistas'),
    el('option', { value: 'nova' }, 'Só novas'),
    el('option', { value: 'arquivada' }, 'Arquivadas'),
    el('option', { value: 'todas' }, 'Todas'));

  painel.replaceChildren(
    el('aside', { class: 'lista' },
      el('div', { class: 'lista-filtros' },
        el('div', { class: 'row' },
          el('button', { class: 'btn small', onclick: enviarFicha }, '+ Enviar ficha para cliente'),
          el('button', { class: 'btn ghost small', onclick: carregar, title: 'Atualizar lista' }, '↻ Atualizar')),
        busca,
        el('div', { class: 'row' }, selStatus, selForm)),
      lista),
    detalhe);
  app.replaceChildren(banner(api) || '', barraTopo(pessoa, 'fichas'), painel);
  mostrarVazio();
  await carregar();
  const id = new URLSearchParams(location.hash.slice(1)).get('ficha');
  if (id) abrir(id);
});

async function carregar() {
  lista.replaceChildren(el('div', { class: 'vazio' }, 'Carregando…'));
  try {
    fichas = await api.listarFichas();
  } catch (e) {
    console.error(e);
    lista.replaceChildren(el('div', { class: 'vazio' }, 'Não foi possível carregar as fichas: ' + e.message));
    return;
  }
  const titulos = [...new Set(fichas.map((f) => f.form_title))].sort();
  selForm.replaceChildren(el('option', { value: '' }, 'Todos os questionários'), ...titulos.map((t) => el('option', { value: t }, t)));
  selForm.value = titulos.includes(filtro.form) ? filtro.form : '';
  desenharLista();
}

function desenharLista() {
  const t = filtro.texto.trim().toLowerCase();
  const digitos = t.replace(/\D/g, '');
  const visiveis = fichas.filter((f) =>
    (filtro.status === 'todas' || (filtro.status === 'ativas' ? f.status !== 'arquivada' : f.status === filtro.status)) &&
    (!filtro.form || f.form_title === filtro.form) &&
    (!t || f.client_name.toLowerCase().includes(t) || (digitos && (f.client_phone || '').replace(/\D/g, '').includes(digitos))));

  if (!visiveis.length) {
    lista.replaceChildren(el('div', { class: 'vazio' }, fichas.length ? 'Nenhuma ficha com esses filtros.' : 'Ainda não chegou nenhuma ficha. Envie o link para suas clientes! 💕'));
    return;
  }
  lista.replaceChildren(...visiveis.map((f) => {
    const nAlertas = (f.alertas || []).length;
    return el('button', { class: 'item' + (selecionada?.id === f.id ? ' sel' : ''), onclick: () => abrir(f.id) },
      el('div', { class: 'nome' }, f.client_name, el('span', { class: 'badge ' + f.status }, STATUS[f.status])),
      el('div', { class: 'meta' }, f.form_title + ' · ' + dataHora(f.created_at)),
      nAlertas ? el('span', { class: 'badge alerta' }, `⚠ ${nAlertas} ${nAlertas === 1 ? 'ponto' : 'pontos'} de atenção`) : null);
  }));
}

function mostrarVazio() {
  painel.classList.remove('com-detalhe');
  detalhe.replaceChildren(el('div', { class: 'vazio' }, 'Selecione uma ficha na lista para ver as respostas.'));
}

async function abrir(id) {
  painel.classList.add('com-detalhe');
  detalhe.replaceChildren(el('div', { class: 'vazio' }, 'Abrindo ficha…'));
  let s;
  try {
    s = await api.ficha(id);
  } catch (e) {
    console.error(e);
  }
  if (!s) {
    detalhe.replaceChildren(el('div', { class: 'vazio' }, 'Ficha não encontrada.'));
    return;
  }
  selecionada = s;
  history.replaceState(null, '', '#ficha=' + id);
  if (s.status === 'nova') await mudarStatus('vista', false);
  desenharLista();
  desenharDetalhe();
  if (matchMedia('(max-width: 860px)').matches) scrollTo(0, 0);
}

async function mudarStatus(status, avisar = true) {
  try {
    await api.atualizarFicha(selecionada.id, { status });
    selecionada.status = status;
    const naLista = fichas.find((f) => f.id === selecionada.id);
    if (naLista) naLista.status = status;
    if (avisar) { toast('Ficha marcada como ' + STATUS[status].toLowerCase()); desenharLista(); desenharDetalhe(); }
  } catch (e) {
    toast('Não foi possível salvar: ' + e.message, 'erro');
  }
}

function desenharDetalhe() {
  const s = selecionada;
  const schema = s.form_schema;
  const avisos = alertas(schema, s.answers);
  const fone = (s.client_phone || '').replace(/\D/g, '');

  const acoes = el('div', { class: 'acoes' },
    el('button', { class: 'btn ghost small', onclick: () => print() }, 'Imprimir'),
    s.status === 'arquivada'
      ? el('button', { class: 'btn ghost small', onclick: () => mudarStatus('vista') }, 'Desarquivar')
      : el('button', { class: 'btn ghost small', onclick: () => mudarStatus('arquivada') }, 'Arquivar'),
    s.status !== 'nova' ? el('button', { class: 'btn ghost small', onclick: () => mudarStatus('nova') }, 'Marcar como nova') : null,
    pessoa.papel === 'admin' ? el('button', { class: 'btn danger small', onclick: excluir }, 'Excluir') : null);

  detalhe.replaceChildren(...[
    el('button', { class: 'btn-link so-celular nao-imprimir', onclick: () => { selecionada = null; history.replaceState(null, '', location.pathname); mostrarVazio(); desenharLista(); } }, '← Voltar para a lista'),
    el('div', { class: 'det-head' },
      el('div', {},
        el('h2', {}, s.client_name),
        el('div', { class: 'muted' }, s.form_title, ' · enviada em ', dataHora(s.created_at), ' · ', el('span', { class: 'badge ' + s.status }, STATUS[s.status])),
        fone ? el('a', { class: 'btn-link nao-imprimir', href: linkWhatsApp(fone, `Oi, ${primeiroNome(s.client_name)}! Tudo bem? 🌸\n\n`), target: '_blank', rel: 'noopener' }, 'Conversar no WhatsApp: ' + s.client_phone) : null),
      acoes),
    avisos.length ? el('div', { class: 'alert-box' },
      el('h3', {}, '⚠ Pontos de atenção'),
      el('ul', {}, avisos.map((a) => el('li', {}, a.label, a.detalhe ? el('strong', {}, ' — ' + a.detalhe) : null)))) : null,
    (schema.sections || []).map((sec) => {
      const campos = (sec.fields || []).filter((f) => f.type !== 'info');
      if (!campos.length) return null;
      return el('div', { class: 'det-sec' },
        el('h3', {}, sec.title),
        el('div', { class: 'resp-grid' }, campos.flatMap((f) => [el('div', { class: 'q' }, f.label), el('div', {}, respostaView(f, s.answers?.[f.id]))])));
    }),
    caixaAgendamentos(),
    caixaSessoes(),
    caixaObservacoes(),
  ].flat().filter(Boolean));
}

function caixaAgendamentos() {
  const s = selecionada;
  const lista = el('div', {}, el('p', { class: 'muted' }, 'Carregando…'));
  api.agendamentosDaFicha(s.id).then((itens) => {
    if (selecionada !== s) return;
    lista.replaceChildren(itens.length
      ? el('ul', { class: 'ag-mini' }, itens.map((a) => el('li', {},
        el('a', { class: 'btn-link', href: 'agenda.html#dia=' + diaNoFuso(a.inicio, 'America/Sao_Paulo') }, dataHora(a.inicio)),
        ' · ', a.servico, ' · ', el('span', { class: 'badge ' + (a.status === 'cancelado' ? 'arquivada' : 'vista') }, a.status))))
      : el('p', { class: 'muted' }, 'A cliente ainda não agendou pelo link. ',
        el('button', { class: 'btn-link', onclick: async () => modal('Enviar link de agendamento', painelEnvio({
          opcoes: [{ titulo: 'Agendamento', url: linkAgendamento() }], modelo: (await modelosMensagem()).agendamento,
          nome: s.client_name, telefone: s.client_phone,
        })) }, 'Enviar link de agendamento para a cliente')));
  }).catch(() => lista.replaceChildren(el('p', { class: 'muted' }, 'Não foi possível carregar os agendamentos.')));
  return el('div', { class: 'box nao-imprimir' }, el('h3', {}, 'Agendamentos'), lista);
}

function caixaSessoes() {
  const s = selecionada;
  const sessoes = s.sessions || [];
  const data = el('input', { class: 'input', type: 'date', value: hojeISO(), 'aria-label': 'Data' });
  const numero = el('input', { class: 'input', type: 'number', min: '1', value: String(sessoes.length + 1), 'aria-label': 'Nº da sessão' });
  const area = el('input', { class: 'input', placeholder: 'Área tratada', 'aria-label': 'Área tratada' });
  const produto = el('input', { class: 'input', placeholder: 'Regenerador / produto', 'aria-label': 'Regenerador ou produto' });
  const obs = el('input', { class: 'input', placeholder: 'Observações da sessão (opcional)', 'aria-label': 'Observações' });

  const salvar = async (novas, msg) => {
    try {
      await api.atualizarFicha(s.id, { sessions: novas });
      s.sessions = novas;
      toast(msg);
      desenharDetalhe();
    } catch (e) {
      toast('Não foi possível salvar: ' + e.message, 'erro');
    }
  };

  return el('div', { class: 'box' },
    el('h3', {}, 'Sessões realizadas'),
    sessoes.length
      ? el('div', { class: 'tabela-wrap' }, el('table', { class: 'tabela' },
        el('thead', {}, el('tr', {}, ['Data', 'Nº', 'Área', 'Regenerador', 'Observações', ''].map((t) => el('th', {}, t)))),
        el('tbody', {}, sessoes.map((r) => el('tr', {},
          el('td', {}, dataCurta(r.data)), el('td', {}, r.numero), el('td', {}, r.area), el('td', {}, r.produto), el('td', {}, r.obs),
          el('td', { class: 'nao-imprimir' }, el('button', { class: 'icon-btn', title: 'Remover sessão', 'aria-label': 'Remover sessão', onclick: () => {
            if (confirm('Remover esta sessão?')) salvar(sessoes.filter((x) => x.id !== r.id), 'Sessão removida');
          } }, '✕')))))))
      : el('p', { class: 'muted' }, 'Nenhuma sessão registrada ainda.'),
    el('div', { class: 'nova-sessao nao-imprimir' }, data, numero, area, produto,
      el('div', { class: 'full' }, obs, el('button', { class: 'btn small', onclick: () => {
        if (!data.value) return toast('Informe a data da sessão', 'erro');
        salvar([...sessoes, { id: uid('ses'), data: data.value, numero: numero.value, area: area.value.trim(), produto: produto.value.trim(), obs: obs.value.trim() }], 'Sessão registrada');
      } }, '+ Registrar sessão'))));
}

function caixaObservacoes() {
  const s = selecionada;
  const texto = el('textarea', { class: 'input', rows: '4', value: s.notes || '', placeholder: 'Anotações da avaliação, evolução, cuidados combinados…' });
  return el('div', { class: 'box' },
    el('h3', {}, 'Observações da profissional'),
    texto,
    el('div', { class: 'nao-imprimir', style: 'margin-top:8px;text-align:right' },
      el('button', { class: 'btn small', onclick: async () => {
        try {
          await api.atualizarFicha(s.id, { notes: texto.value.trim() || null });
          s.notes = texto.value.trim() || null;
          toast('Observações salvas');
        } catch (e) {
          toast('Não foi possível salvar: ' + e.message, 'erro');
        }
      } }, 'Salvar observações')));
}

async function excluir() {
  if (!confirm(`Excluir a ficha de ${selecionada.client_name}? Isso não pode ser desfeito.`)) return;
  try {
    await api.excluirFicha(selecionada.id);
    fichas = fichas.filter((f) => f.id !== selecionada.id);
    selecionada = null;
    history.replaceState(null, '', location.pathname);
    toast('Ficha excluída');
    mostrarVazio();
    desenharLista();
  } catch (e) {
    toast('Não foi possível excluir: ' + e.message, 'erro');
  }
}

async function enviarFicha() {
  let forms = [];
  try {
    forms = (await api.listarFormularios()).filter((f) => f.active);
  } catch (e) {
    return toast('Não foi possível carregar os questionários: ' + e.message, 'erro');
  }
  modal('Enviar ficha para cliente', forms.length
    ? el('div', {},
      el('p', { class: 'muted', style: 'margin-top:0' }, 'A cliente preenche pelo celular e a ficha aparece aqui na hora. 💕'),
      painelEnvio({ opcoes: forms.map((f) => ({ titulo: f.title, url: linkDaFicha(f.slug) })), modelo: (await modelosMensagem()).ficha }))
    : el('p', {}, 'Nenhum questionário ativo. Crie ou ative um no editor.'));
}
