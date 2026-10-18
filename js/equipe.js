// Login e barra de navegação das páginas da equipe (painel e editor).
import { api } from './api.js?v=202610180434';
import { el, banner, linkDaFicha, copiar, linkWhatsApp, preencher, primeiroNome, mascaraTelefone, toast } from './util.js?v=202610180434';
import { mensagens } from './modelo-padrao.js?v=202610180434';
import { NOME_EMPRESA } from './config.js?v=202610180434';

// Mostra o login (se preciso) e chama aoEntrar(pessoa) quando houver sessão.
export async function exigirLogin(app, titulo, aoEntrar) {
  let pessoa = null;
  try {
    pessoa = await api.sessao();
  } catch (e) {
    console.error(e);
  }
  if (pessoa) return aoEntrar(pessoa);

  const erro = el('div', { class: 'erro', role: 'alert' });
  const email = el('input', { class: 'input', type: 'email', placeholder: 'E-mail', autocomplete: 'username', required: true });
  const senha = el('input', { class: 'input', type: 'password', placeholder: 'Senha', autocomplete: 'current-password', required: !api.demo });
  const botao = el('button', { class: 'btn', type: 'submit' }, 'Entrar');
  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      erro.textContent = '';
      botao.disabled = true;
      try {
        aoEntrar(await api.entrar(email.value.trim(), senha.value));
      } catch (err) {
        erro.textContent = /invalid login/i.test(err.message) ? 'E-mail ou senha incorretos.' : err.message;
        botao.disabled = false;
      }
    },
  }, email, senha, erro, botao);

  app.replaceChildren(banner(api) || '', el('div', { class: 'login' },
    el('img', { src: 'assets/monograma.jpg', alt: NOME_EMPRESA }),
    el('h1', {}, titulo),
    api.demo ? el('p', { class: 'muted' }, 'No modo demonstração, qualquer e-mail entra.') : null,
    form));
  email.focus();
}

export function barraTopo(pessoa, ativo) {
  const link = (href, texto, chave) => el('a', { href, class: ativo === chave ? 'active' : null }, texto);
  return el('header', { class: 'topbar' },
    el('img', { class: 'mono', src: 'assets/monograma.jpg', alt: '' }),
    el('div', { class: 'brand' }, NOME_EMPRESA, el('small', {}, 'Olá, ' + (pessoa.nome || pessoa.email))),
    el('nav', {},
      link('agenda.html', 'Agenda', 'agenda'),
      link('profissional.html', 'Fichas', 'fichas'),
      pessoa.papel === 'admin' ? link('editor.html', 'Editar questionários', 'editor') : null,
      el('button', { class: 'btn ghost small', onclick: async () => { await api.sair(); location.reload(); } }, 'Sair')));
}

export function modal(titulo, conteudo) {
  const fechar = () => { fundo.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => e.key === 'Escape' && fechar();
  const fundo = el('div', { class: 'modal-fundo', onclick: (e) => e.target === fundo && fechar() },
    el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
      el('div', { class: 'modal-head' }, el('h2', {}, titulo), el('button', { class: 'icon-btn', 'aria-label': 'Fechar', onclick: fechar }, '✕')),
      el('div', { class: 'modal-body' }, conteudo)));
  document.addEventListener('keydown', esc);
  document.body.append(fundo);
  return fechar;
}

// Modelos de mensagem (configurados na Agenda → Horários e serviços)
let modelos;
export async function modelosMensagem() {
  if (!modelos) {
    try { modelos = mensagens(await api.configAgenda()); } catch { modelos = mensagens(); }
  }
  return modelos;
}

// Painel de envio da ficha ou do link de agendamento pelo WhatsApp.
// opcoes: [{ titulo, url }] (mais de uma vira um seletor); modelo: texto com {nome} e {link}.
export function painelEnvio({ opcoes, modelo, nome = '', telefone = '' }) {
  let editado = false;
  const escolha = el('select', { class: 'input' }, opcoes.map((o, i) => el('option', { value: String(i) }, o.titulo)));
  const dNome = el('input', { class: 'input', value: nome, placeholder: 'Ex.: Maria', autocomplete: 'off' });
  const dTel = el('input', { class: 'input', type: 'tel', value: mascaraTelefone(telefone), placeholder: '(00) 00000-0000', autocomplete: 'off' });
  const texto = el('textarea', { class: 'input envio-msg', rows: '11', 'aria-label': 'Mensagem' });
  const enviar = el('a', { class: 'btn envio-whats', target: '_blank', rel: 'noopener' }, 'Enviar no WhatsApp');
  const dica = el('p', { class: 'f-help envio-dica' });
  const restaurar = el('button', { type: 'button', class: 'btn-link', hidden: true, onclick: () => { editado = false; atualizar(); } }, '↺ Voltar ao texto sugerido');

  const url = () => opcoes[Number(escolha.value) || 0].url;
  function atualizar() {
    if (!editado) texto.value = preencher(modelo, { nome: primeiroNome(dNome.value), link: url() });
    restaurar.hidden = !editado;
    const fone = dTel.value.replace(/\D/g, '');
    const foneOk = fone.length >= 10;
    enviar.href = linkWhatsApp(foneOk ? fone : '', texto.value);
    dica.textContent = foneOk
      ? '✓ A conversa vai abrir direto com a cliente.'
      : 'Sem o número, o WhatsApp abre e você escolhe o contato.';
  }
  dNome.addEventListener('input', atualizar);
  dTel.addEventListener('input', () => { dTel.value = mascaraTelefone(dTel.value); atualizar(); });
  escolha.addEventListener('change', () => { editado = false; atualizar(); });
  texto.addEventListener('input', () => { editado = true; restaurar.hidden = false; atualizar(); });
  atualizar();

  return el('div', { class: 'envio' },
    opcoes.length > 1 ? el('label', { class: 'campo-form full' }, el('span', { class: 'lbl' }, 'Qual ficha?'), escolha) : null,
    el('label', { class: 'campo-form' }, el('span', { class: 'lbl' }, 'Nome da cliente (opcional)'), dNome),
    el('label', { class: 'campo-form' }, el('span', { class: 'lbl' }, 'WhatsApp da cliente (opcional)'), dTel),
    el('div', { class: 'campo-form full' },
      el('div', { class: 'envio-topo' }, el('span', { class: 'lbl' }, 'Mensagem (pode personalizar antes de enviar)'), restaurar),
      texto),
    el('div', { class: 'full envio-acoes' },
      enviar,
      el('button', { type: 'button', class: 'btn ghost small', onclick: () => copiar(texto.value).then(() => toast('Mensagem copiada!')) }, 'Copiar mensagem'),
      el('button', { type: 'button', class: 'btn ghost small', onclick: () => copiar(url()) }, 'Copiar só o link'),
      el('a', { class: 'btn ghost small', href: url(), target: '_blank', rel: 'noopener', onclick: (e) => { e.currentTarget.href = url(); } }, 'Ver como a cliente vê')),
    el('div', { class: 'full' }, dica));
}

// Envio de uma ficha específica
export async function compartilhar(form, cliente = {}) {
  return painelEnvio({ opcoes: [{ titulo: form.title, url: linkDaFicha(form.slug) }], modelo: (await modelosMensagem()).ficha, ...cliente });
}
