// Página aberta pelo link do e-mail "Esqueci minha senha": cria a senha nova.
import { api } from './api.js?v=202610181407';
import { el, toast } from './util.js?v=202610181407';
import { NOME_EMPRESA } from './config.js?v=202610181407';

const app = document.getElementById('app');
// Lido antes do Supabase limpar o endereço: link vencido chega com #error=...
const erroNoLink = new URLSearchParams(location.hash.slice(1)).get('error_code');

function tela(...conteudo) {
  app.replaceChildren(el('div', { class: 'login' },
    el('img', { src: 'assets/monograma.jpg', alt: NOME_EMPRESA }),
    el('h1', {}, 'Criar nova senha'),
    ...conteudo));
}

const irParaLogin = () => el('a', { class: 'btn', href: 'agenda.html' }, 'Ir para o login');

function linkInvalido() {
  tela(
    el('p', {}, 'Este link expirou ou já foi usado. 🌸'),
    el('p', { class: 'muted' }, 'Por segurança, cada link funciona uma vez só e por pouco tempo. Peça um novo na tela de login, em "Esqueci minha senha".'),
    irParaLogin());
}

async function iniciar() {
  if (erroNoLink) return linkInvalido();
  let valido = false;
  try {
    valido = await api.sessaoDeRecuperacao();
  } catch (e) {
    console.error(e);
  }
  if (!valido) return linkInvalido();

  const senha = el('input', { class: 'input', type: 'password', placeholder: 'Nova senha', autocomplete: 'new-password', required: true, minlength: '8' });
  const repetir = el('input', { class: 'input', type: 'password', placeholder: 'Repita a nova senha', autocomplete: 'new-password', required: true });
  const erro = el('div', { class: 'erro', role: 'alert' });
  const botao = el('button', { class: 'btn', type: 'submit' }, 'Salvar nova senha');

  tela(el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      erro.textContent = '';
      if (senha.value.length < 8) return (erro.textContent = 'Use pelo menos 8 caracteres.');
      if (senha.value !== repetir.value) return (erro.textContent = 'As duas senhas não são iguais.');
      botao.disabled = true;
      try {
        await api.definirNovaSenha(senha.value);
        tela(el('p', { class: 'login-ok' }, '✓ Senha alterada com sucesso!'), irParaLogin());
      } catch (err) {
        console.error(err);
        erro.textContent = /different from the old|same/i.test(err.message)
          ? 'A senha nova precisa ser diferente da anterior.'
          : /weak|short|characters/i.test(err.message)
            ? 'Senha fraca. Misture letras, números e símbolos.'
            : 'Não foi possível salvar. Peça um novo link e tente de novo.';
        botao.disabled = false;
        toast('Não foi possível salvar a senha', 'erro');
      }
    },
  },
  el('p', { class: 'muted', style: 'margin:0' }, 'Escolha uma senha com pelo menos 8 caracteres, que você não use em outros sites.'),
  senha, repetir, erro, botao));
  senha.focus();
}

iniciar();
