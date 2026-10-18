// Página que a cliente abre pelo link: index.html?f=<endereço-da-ficha>
import { api } from './api.js?v=202610180440';
import { renderForm } from './render.js?v=202610180440';
import { el, banner, toast } from './util.js?v=202610180440';
import { NOME_EMPRESA } from './config.js?v=202610180440';

const app = document.getElementById('app');
const slug = new URLSearchParams(location.search).get('f');

function cabecalho(form) {
  return el('header', { class: 'client-header' },
    el('img', { class: 'logo', src: 'assets/logo.jpg', alt: NOME_EMPRESA }),
    form ? el('h1', {}, form.schema.title || form.title) : null,
    form?.schema.subtitle ? el('div', { class: 'subtitle' }, form.schema.subtitle) : null);
}

async function iniciar() {
  let form;
  try {
    form = await api.fichaPublica(slug);
  } catch (e) {
    console.error(e);
    app.replaceChildren(cabecalho(), el('div', { class: 'center-msg' }, 'Não foi possível carregar a ficha. Verifique sua internet e tente de novo.'));
    return;
  }
  if (!form) {
    app.replaceChildren(cabecalho(), el('div', { class: 'center-msg' }, 'Esta ficha não está disponível. Peça um novo link para a sua profissional. 💕'));
    return;
  }
  document.title = (form.schema.title || form.title) + ' · ' + NOME_EMPRESA;

  const corpo = el('div');
  const ficha = renderForm(corpo, form.schema);
  const botao = el('button', { type: 'submit', class: 'btn big' }, 'Enviar ficha');
  const formulario = el('form', { novalidate: '', onsubmit: enviar }, corpo, botao);

  async function enviar(e) {
    e.preventDefault();
    const { answers, errors } = ficha.collect();
    if (errors.length) {
      errors[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast(errors.length === 1 ? 'Falta responder 1 pergunta.' : `Faltam ${errors.length} perguntas para responder.`, 'erro');
      return;
    }
    botao.disabled = true;
    botao.textContent = 'Enviando…';
    try {
      const enviada = await api.enviar(form, answers);
      const agendar = form.schema.oferecer_agendamento !== false;
      if (agendar) {
        // a página de agendamento já abre com nome e telefone preenchidos
        try { sessionStorage.setItem('regenera_cliente', JSON.stringify({ ficha: enviada.id, nome: enviada.nome, telefone: enviada.telefone })); } catch { /* ok */ }
      }
      app.replaceChildren(banner(api) || '', cabecalho(), el('main', { class: 'client-wrap' },
        el('div', { class: 'thanks' },
          el('h2', {}, 'Ficha enviada! Obrigada 💕'),
          agendar
            ? el('div', {},
              el('p', {}, 'Suas respostas chegaram para a profissional.'),
              el('p', { class: 'pergunta-agendar' }, 'Quer agendar seu horário agora?'),
              el('div', { class: 'thanks-acoes' },
                el('a', { class: 'btn big', href: 'agendamento.html' }, 'Sim, quero agendar'),
                el('button', { class: 'btn ghost', onclick: (e) => {
                  e.target.closest('.thanks-acoes').replaceWith(el('p', { class: 'muted' }, 'Tudo bem! Quando quiser, é só falar comigo. Até breve! 🌸'));
                } }, 'Agora não')))
            : el('p', {}, 'Suas respostas chegaram para a profissional. Nos vemos no seu procedimento!'))));
      scrollTo(0, 0);
    } catch (err) {
      console.error(err);
      toast('Não foi possível enviar. Verifique sua internet e tente de novo.', 'erro');
      botao.disabled = false;
      botao.textContent = 'Enviar ficha';
    }
  }

  app.replaceChildren(
    banner(api) || '',
    cabecalho(form),
    el('main', { class: 'client-wrap' },
      form.schema.intro ? el('p', { class: 'intro' }, form.schema.intro) : null,
      formulario,
      el('p', { class: 'footer-note' }, 'Seus dados são confidenciais e usados apenas para o seu atendimento.')));
}

iniciar();
