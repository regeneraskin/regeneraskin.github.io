// Login e barra de navegação das páginas da equipe (painel e editor).
import { api } from './api.js';
import { el, banner, linkDaFicha, copiar } from './util.js';
import { NOME_EMPRESA } from './config.js';

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

// Caixa com o link da ficha + botão de WhatsApp
export function compartilhar(form) {
  const url = linkDaFicha(form.slug);
  return compartilharLink(url, `Oi! Antes do seu procedimento, preencha sua ficha por aqui, por favor: ${url}`);
}

export function compartilharLink(url, msg) {
  return el('div', {},
    el('div', { class: 'share-row' },
      el('input', { class: 'input', value: url, readonly: '', onfocus: (e) => e.target.select(), 'aria-label': 'Link da ficha' }),
      el('button', { class: 'btn small', type: 'button', onclick: () => copiar(url) }, 'Copiar link'),
      el('a', { class: 'btn ghost small', href: 'https://wa.me/?text=' + encodeURIComponent(msg), target: '_blank', rel: 'noopener' }, 'Enviar no WhatsApp'),
      el('a', { class: 'btn ghost small', href: url, target: '_blank', rel: 'noopener' }, 'Abrir')));
}
