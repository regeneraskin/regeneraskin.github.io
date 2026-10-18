// Editor dos questionários (só para administradoras).
import { api } from './api.js';
import { TIPOS, FORMATOS, renderForm } from './render.js';
import { modeloPadrao } from './modelo-padrao.js';
import { el, banner, toast, uid, clone, slugify } from './util.js';
import { exigirLogin, barraTopo, modal, compartilhar } from './equipe.js';

const app = document.getElementById('app');

let forms = [];
let atual = null; // cópia em edição
let sujo = false;

const listaForms = el('div');
const principal = el('div', { class: 'ed-main' });
const status = el('span', { class: 'status' });

addEventListener('beforeunload', (e) => {
  if (sujo) e.preventDefault();
});

exigirLogin(app, 'Editor de Fichas', async (pessoa) => {
  if (pessoa.papel !== 'admin') {
    app.replaceChildren(barraTopo(pessoa, 'editor'),
      el('div', { class: 'center-msg' }, 'Só administradoras podem editar os questionários.'));
    return;
  }
  app.replaceChildren(banner(api) || '', barraTopo(pessoa, 'editor'),
    el('main', { class: 'editor' },
      el('aside', { class: 'ed-forms' },
        el('h2', {}, 'Questionários'),
        listaForms,
        el('div', { class: 'novo' },
          el('button', { class: 'btn small', onclick: () => novo(modeloPadrao()) }, '+ Novo a partir do modelo'),
          el('button', { class: 'btn ghost small', onclick: () => novo({ title: 'Nova ficha', subtitle: '', intro: '', sections: [{ id: uid('s'), title: 'Dados pessoais', fields: [{ id: uid('c'), type: 'short', format: 'nome', label: 'Nome completo', required: true }] }] }) }, '+ Novo em branco'))),
      principal));
  await carregar();
  if (forms.length) abrir(forms[0]);
  else principal.replaceChildren(el('div', { class: 'card vazio' }, 'Nenhum questionário ainda. Crie o primeiro ao lado.'));
});

async function carregar() {
  try {
    forms = await api.listarFormularios();
  } catch (e) {
    toast('Não foi possível carregar: ' + e.message, 'erro');
  }
  desenharLista();
}

function desenharLista() {
  listaForms.replaceChildren(...forms.map((f) => el('button', {
    class: 'item' + (atual?.id === f.id ? ' sel' : ''),
    onclick: () => abrir(f),
  }, el('div', { class: 'nome' }, f.title), el('div', { class: 'meta' }, f.active ? 'Ativo' : 'Desativado (link fora do ar)'))));
}

function podeSair() {
  return !sujo || confirm('Existem alterações não salvas. Descartar?');
}

function abrir(f) {
  if (atual && f.id !== atual.id && !podeSair()) return;
  atual = clone(f);
  marcar(false);
  desenharLista();
  desenhar();
}

function novo(schema) {
  if (!podeSair()) return;
  let slug = slugify(schema.title) || 'ficha';
  for (let n = 2; forms.some((f) => f.slug === slug); n++) slug = slugify(schema.title) + '-' + n;
  atual = { title: schema.title, slug, active: true, schema };
  marcar(true);
  desenharLista();
  desenhar();
}

function marcar(valor) {
  sujo = valor;
  status.textContent = sujo ? '● Alterações não salvas' : (atual?.id ? '✓ Tudo salvo' : '');
  status.className = 'status' + (sujo ? ' sujo' : '');
}

// Liga um campo de texto a uma propriedade, sem redesenhar (mantém o foco)
function texto(obj, chave, attrs = {}, tag = 'input') {
  return el(tag, {
    class: 'input', value: obj[chave] || '',
    oninput: (e) => { obj[chave] = e.target.value; marcar(true); },
    ...attrs,
  });
}

function mover(lista, i, delta) {
  const j = i + delta;
  if (j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  marcar(true);
  desenhar();
}

function desenhar() {
  const s = atual.schema;
  const slug = el('input', {
    class: 'input', value: atual.slug, pattern: '[a-z0-9-]+',
    oninput: (e) => { atual.slug = e.target.value; marcar(true); },
    onchange: (e) => { atual.slug = slugify(e.target.value); e.target.value = atual.slug; },
  });

  principal.replaceChildren(...[
    el('div', { class: 'ed-toolbar' }, status,
      el('button', { class: 'btn ghost small', onclick: previa }, 'Pré-visualizar'),
      atual.id ? el('button', { class: 'btn ghost small', onclick: async () => modal('Link da ficha', await compartilhar(atual)) }, 'Link para clientes') : null,
      el('button', { class: 'btn small', onclick: salvar }, 'Salvar')),
    el('div', { class: 'card' },
      el('div', { class: 'card-row' },
        el('div', {}, el('label', { class: 'lbl' }, 'Título da ficha'), texto(atual, 'title', {
          oninput: (e) => { atual.title = e.target.value; s.title = e.target.value; marcar(true); },
        })),
        el('div', {}, el('label', { class: 'lbl' }, 'Subtítulo (opcional)'), texto(s, 'subtitle', { placeholder: 'Ex.: Microderme' })),
        el('div', { class: 'full' }, el('label', { class: 'lbl' }, 'Mensagem de boas-vindas (opcional)'), texto(s, 'intro', { rows: '2' }, 'textarea')),
        el('div', {}, el('label', { class: 'lbl' }, 'Endereço do link'), slug,
          el('div', { class: 'f-help', style: 'margin-top:4px' }, 'Só letras minúsculas, números e hífen. Mudar isso quebra links já enviados.')),
        el('div', { style: 'align-self:center' },
          el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!atual.active, onchange: (e) => { atual.active = e.target.checked; marcar(true); } }),
            'Ficha ativa (clientes conseguem abrir o link)')),
        el('div', { class: 'full' },
          el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: s.oferecer_agendamento !== false, onchange: (e) => { s.oferecer_agendamento = e.target.checked; marcar(true); } }),
            'Ao terminar, perguntar se a cliente quer agendar um horário')))),
    s.sections.map((sec, i) => cartaoSecao(sec, i)),
    el('button', { class: 'btn ghost', onclick: () => { s.sections.push({ id: uid('s'), title: 'Nova seção', fields: [] }); marcar(true); desenhar(); } }, '+ Adicionar seção'),
    atual.id ? el('div', { style: 'text-align:right' }, el('button', { class: 'btn danger small', onclick: excluir }, 'Excluir este questionário')) : null,
  ].flat().filter(Boolean));
}

function cartaoSecao(sec, i) {
  const secoes = atual.schema.sections;
  return el('section', { class: 'card sec-card' },
    el('div', { class: 'sec-head' },
      texto(sec, 'title', { 'aria-label': 'Título da seção' }),
      el('button', { class: 'icon-btn', title: 'Subir seção', 'aria-label': 'Subir seção', disabled: i === 0, onclick: () => mover(secoes, i, -1) }, '↑'),
      el('button', { class: 'icon-btn', title: 'Descer seção', 'aria-label': 'Descer seção', disabled: i === secoes.length - 1, onclick: () => mover(secoes, i, 1) }, '↓'),
      el('button', { class: 'icon-btn', title: 'Excluir seção', 'aria-label': 'Excluir seção', onclick: () => {
        if (sec.fields.length && !confirm(`Excluir a seção "${sec.title}" e suas ${sec.fields.length} perguntas?`)) return;
        secoes.splice(i, 1); marcar(true); desenhar();
      } }, '✕')),
    sec.fields.map((f, j) => cartaoCampo(sec, f, j)),
    el('div', { class: 'add-campo' },
      el('button', { class: 'btn ghost small', onclick: () => addCampo(sec, { type: 'yesno', label: '', required: true }) }, '+ Pergunta Sim/Não'),
      el('button', { class: 'btn ghost small', onclick: () => addCampo(sec, { type: 'short', format: 'texto', label: '', required: false }) }, '+ Resposta escrita'),
      el('button', { class: 'btn ghost small', onclick: () => addCampo(sec, { type: 'multi', label: '', required: false, options: ['Opção 1', 'Opção 2'] }) }, '+ Opções'),
      el('button', { class: 'btn ghost small', onclick: () => addCampo(sec, { type: 'info', label: '' }) }, '+ Texto informativo')));
}

function addCampo(sec, campo) {
  sec.fields.push({ id: uid('c'), ...campo });
  marcar(true);
  desenhar();
  principal.querySelector(`textarea[data-id="${sec.fields.at(-1).id}"]`)?.focus();
}

function cartaoCampo(sec, f, j) {
  const campos = sec.fields;
  const mudar = (chave, valor) => { f[chave] = valor; marcar(true); };

  const tipo = el('select', { class: 'input', 'aria-label': 'Tipo de resposta', onchange: (e) => {
    f.type = e.target.value;
    if ((f.type === 'choice' || f.type === 'multi') && !f.options?.length) f.options = ['Opção 1', 'Opção 2'];
    if (f.type === 'short' && !f.format) f.format = 'texto';
    if (f.type === 'info') f.required = false;
    marcar(true); desenhar();
  } }, Object.entries(TIPOS).map(([v, t]) => el('option', { value: v, selected: f.type === v }, t)));

  const ops = el('div', { class: 'campo-ops' }, tipo);
  if (f.type !== 'info') {
    ops.append(el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!f.required, onchange: (e) => mudar('required', e.target.checked) }), 'Obrigatória'));
  }
  if (f.type === 'short') {
    ops.append(el('select', { class: 'input', 'aria-label': 'Formato', onchange: (e) => mudar('format', e.target.value) },
      Object.entries(FORMATOS).map(([v, t]) => el('option', { value: v, selected: (f.format || 'texto') === v }, t))));
  }
  if (f.type === 'yesno') {
    ops.append(
      el('label', { class: 'check', title: 'A resposta SIM aparece em destaque para a profissional' },
        el('input', { type: 'checkbox', checked: !!f.alert, onchange: (e) => mudar('alert', e.target.checked) }), '⚠ Destacar se SIM'),
      el('label', { class: 'check' },
        el('input', { type: 'checkbox', checked: !!f.detail, onchange: (e) => { mudar('detail', e.target.checked); desenhar(); } }), 'Perguntar "qual?" se SIM'));
  }

  const extra = el('div', { class: 'campo-extra' });
  if (f.type === 'yesno' && f.detail) {
    extra.append(texto(f, 'detailLabel', { placeholder: 'Texto do complemento (ex.: Qual?)', 'aria-label': 'Texto do complemento' }));
  }
  if (f.type === 'choice' || f.type === 'multi') {
    extra.append(el('label', { class: 'lbl' }, 'Opções (uma por linha)'),
      el('textarea', { class: 'input', rows: String(Math.min(8, Math.max(3, (f.options || []).length))), value: (f.options || []).join('\n'),
        oninput: (e) => mudar('options', e.target.value.split('\n').map((o) => o.trim()).filter(Boolean)) }));
  }
  if (f.type !== 'info') {
    extra.append(texto(f, 'help', { placeholder: 'Dica abaixo da pergunta (opcional)', 'aria-label': 'Dica' }));
  }

  return el('div', { class: 'campo' },
    el('div', { class: 'campo-head' },
      el('textarea', {
        class: 'input', rows: f.type === 'info' || f.type === 'consent' ? '3' : '1', value: f.label || '', 'data-id': f.id,
        placeholder: f.type === 'info' ? 'Texto informativo para a cliente' : 'Escreva a pergunta',
        'aria-label': 'Pergunta',
        oninput: (e) => mudar('label', e.target.value),
      }),
      el('button', { class: 'icon-btn', title: 'Subir', 'aria-label': 'Subir pergunta', disabled: j === 0, onclick: () => mover(campos, j, -1) }, '↑'),
      el('button', { class: 'icon-btn', title: 'Descer', 'aria-label': 'Descer pergunta', disabled: j === campos.length - 1, onclick: () => mover(campos, j, 1) }, '↓'),
      el('button', { class: 'icon-btn', title: 'Duplicar', 'aria-label': 'Duplicar pergunta', onclick: () => { campos.splice(j + 1, 0, { ...clone(f), id: uid('c') }); marcar(true); desenhar(); } }, '⧉'),
      el('button', { class: 'icon-btn', title: 'Excluir', 'aria-label': 'Excluir pergunta', onclick: () => { campos.splice(j, 1); marcar(true); desenhar(); } }, '✕')),
    ops,
    extra.childNodes.length ? extra : null);
}

function previa() {
  const corpo = el('div');
  renderForm(corpo, atual.schema);
  modal('Pré-visualização', el('div', {},
    el('div', { class: 'client-header', style: 'padding-top:0' },
      el('h1', {}, atual.schema.title || atual.title),
      atual.schema.subtitle ? el('div', { class: 'subtitle' }, atual.schema.subtitle) : null),
    atual.schema.intro ? el('p', { class: 'intro' }, atual.schema.intro) : null,
    corpo));
}

function problemas() {
  const s = atual.schema;
  if (!atual.title.trim()) return 'Dê um título para a ficha.';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(atual.slug)) return 'O endereço do link só pode ter letras minúsculas, números e hífen.';
  const campos = s.sections.flatMap((x) => x.fields);
  if (!campos.length) return 'Adicione pelo menos uma pergunta.';
  if (campos.some((f) => !String(f.label || '').trim())) return 'Há perguntas sem texto. Preencha ou exclua.';
  if (campos.some((f) => (f.type === 'choice' || f.type === 'multi') && !f.options?.length)) return 'Há perguntas de opções sem nenhuma opção.';
  if (!campos.some((f) => f.type === 'short' && f.format === 'nome')) return 'Inclua um campo do tipo "Resposta curta" com formato "Nome da cliente", para identificar as fichas.';
  return '';
}

async function salvar() {
  atual.title = atual.title.trim();
  atual.schema.title = atual.title;
  const erro = problemas();
  if (erro) return toast(erro, 'erro');
  try {
    const salvo = await api.salvarFormulario(atual);
    const i = forms.findIndex((f) => f.id === salvo.id);
    if (i >= 0) forms[i] = salvo; else forms.push(salvo);
    const eraNovo = !atual.id;
    atual = clone(salvo);
    marcar(false);
    desenharLista();
    desenhar();
    toast('Questionário salvo! As próximas fichas já usam esta versão.');
    if (eraNovo) modal('Pronto! Link da nova ficha', await compartilhar(atual));
  } catch (e) {
    toast(e.message, 'erro');
  }
}

async function excluir() {
  if (!confirm(`Excluir o questionário "${atual.title}"? As fichas já enviadas continuam guardadas, mas o link para de funcionar.\n\nDica: para só tirar do ar, desmarque "Ficha ativa".`)) return;
  try {
    await api.excluirFormulario(atual.id);
    forms = forms.filter((f) => f.id !== atual.id);
    atual = null;
    marcar(false);
    desenharLista();
    if (forms.length) abrir(forms[0]);
    else principal.replaceChildren(el('div', { class: 'card vazio' }, 'Nenhum questionário. Crie um novo ao lado.'));
    toast('Questionário excluído');
  } catch (e) {
    toast('Não foi possível excluir: ' + e.message, 'erro');
  }
}
