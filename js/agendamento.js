// Página pública de agendamento: agendamento.html
// Pode ser aberta direto (link só de agendamento) ou ao final da ficha,
// quando já chega com nome e telefone preenchidos.
import { api } from './api.js?v=202610181407';
import { NOME_EMPRESA } from './config.js?v=202610181407';
import { mensagens } from './modelo-padrao.js?v=202610181407';
import {
  el, banner, toast, preencher, diaNoFuso, diaDaSemana, somaDias, nomeDoDia, diaPorExtenso, horariosLivres, linkWhatsApp,
} from './util.js?v=202610181407';

const app = document.getElementById('app');

let config;
let ocupados = [];
let vindoDaFicha = {};
const escolha = { servico: null, dia: null, horario: null };

try { vindoDaFicha = JSON.parse(sessionStorage.getItem('regenera_cliente')) || {}; } catch { /* ok */ }

const cabecalho = () => el('header', { class: 'client-header' },
  el('img', { class: 'logo', src: 'assets/logo.jpg', alt: NOME_EMPRESA }),
  el('h1', {}, 'Agende seu horário'));

const corpo = el('main', { class: 'client-wrap' });

async function iniciar() {
  try {
    config = await api.configAgenda();
    await carregarOcupados();
  } catch (e) {
    console.error(e);
    app.replaceChildren(cabecalho(), el('div', { class: 'center-msg' }, 'Não foi possível carregar a agenda. Verifique sua internet e tente de novo.'));
    return;
  }
  if (config.servicos?.length === 1) escolha.servico = config.servicos[0];
  app.replaceChildren(banner(api) || '', cabecalho(), corpo);
  desenhar();
}

async function carregarOcupados() {
  const agora = new Date();
  ocupados = await api.horariosOcupados(agora, new Date(+agora + ((Number(config.dias_a_frente) || 30) + 2) * 86400000));
}

function dias() {
  const hoje = diaNoFuso(new Date(), config.fuso);
  const lista = [];
  for (let i = 0; i <= (Number(config.dias_a_frente) || 30); i++) {
    const dia = somaDias(hoje, i);
    lista.push({ dia, livres: horariosLivres(config, dia, escolha.servico.duracao, ocupados).length });
  }
  return lista.filter((d) => config.horarios?.[diaDaSemana(d.dia)]?.length);
}

function passo(numero, titulo, ...conteudo) {
  return el('section', { class: 'f-section passo' },
    el('h2', { class: 'f-section-title' }, el('span', { class: 'passo-num' }, numero), titulo),
    ...conteudo);
}

function desenhar() {
  const secoes = [];
  if (config.mensagem) secoes.push(el('p', { class: 'intro' }, config.mensagem));

  secoes.push(passo('1', 'Qual atendimento?',
    el('div', { class: 'options' }, (config.servicos || []).map((s) => el('label', { class: 'option' },
      el('input', { type: 'radio', name: 'servico', checked: escolha.servico?.nome === s.nome, onchange: () => {
        escolha.servico = s;
        escolha.horario = null;
        if (escolha.dia && !horariosLivres(config, escolha.dia, s.duracao, ocupados).length) escolha.dia = null;
        desenhar();
      } }),
      el('span', {}, s.nome, el('small', { class: 'muted' }, ` · ${duracaoTexto(s.duracao)}`)))))));

  if (escolha.servico) {
    const lista = dias();
    secoes.push(passo('2', 'Escolha o dia',
      lista.some((d) => d.livres)
        ? el('div', { class: 'dias' }, lista.map((d) => el('button', {
          type: 'button', class: 'dia' + (escolha.dia === d.dia ? ' sel' : ''), disabled: !d.livres,
          'aria-pressed': String(escolha.dia === d.dia),
          onclick: () => { escolha.dia = d.dia; escolha.horario = null; desenhar(); document.querySelector('.horarios')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
        },
        el('span', { class: 'dia-sem' }, nomeDoDia(d.dia, true)),
        el('span', { class: 'dia-num' }, d.dia.slice(8, 10) + '/' + d.dia.slice(5, 7)),
        el('span', { class: 'dia-livres' }, d.livres ? `${d.livres} ${d.livres === 1 ? 'horário' : 'horários'}` : 'sem horários'))))
        : el('p', { class: 'muted' }, 'Não há horários livres nos próximos dias. Fale comigo pelo WhatsApp! 💕')));
  }

  if (escolha.servico && escolha.dia) {
    const livres = horariosLivres(config, escolha.dia, escolha.servico.duracao, ocupados);
    secoes.push(passo('3', 'Escolha o horário',
      el('p', { class: 'muted', style: 'margin-top:0' }, diaPorExtenso(escolha.dia)),
      el('div', { class: 'horarios' }, livres.map((h) => el('button', {
        type: 'button', class: 'horario' + (escolha.horario?.hora === h.hora ? ' sel' : ''),
        'aria-pressed': String(escolha.horario?.hora === h.hora),
        onclick: () => { escolha.horario = h; desenhar(); document.querySelector('.confirmar')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
      }, h.hora)))));
  }

  if (escolha.horario) secoes.push(confirmacao());

  corpo.replaceChildren(...secoes);
}

function duracaoTexto(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h}h` : '', m ? `${m}min` : ''].filter(Boolean).join(' ');
}

function confirmacao() {
  const nome = el('input', { class: 'input', id: 'ag-nome', autocomplete: 'name', value: vindoDaFicha.nome || '' });
  const telefone = el('input', { class: 'input', id: 'ag-tel', type: 'tel', autocomplete: 'tel', value: vindoDaFicha.telefone || '', placeholder: '(00) 00000-0000' });
  const botao = el('button', { type: 'submit', class: 'btn big' }, 'Confirmar agendamento');

  const form = el('form', { class: 'confirmar', onsubmit: async (e) => {
    e.preventDefault();
    if (!nome.value.trim()) { nome.focus(); return toast('Informe seu nome', 'erro'); }
    if (telefone.value.replace(/\D/g, '').length < 10) { telefone.focus(); return toast('Informe seu telefone com DDD', 'erro'); }
    botao.disabled = true;
    botao.textContent = 'Agendando…';
    const { servico, dia, horario } = escolha;
    try {
      await api.agendar({ inicio: horario.inicio, servico: servico.nome, nome: nome.value.trim(), telefone: telefone.value.trim(), ficha: vindoDaFicha.ficha });
      try { sessionStorage.removeItem('regenera_cliente'); } catch { /* ok */ }
      sucesso(servico, dia, horario, nome.value.trim());
    } catch (err) {
      console.error(err);
      toast(err.message || 'Não foi possível agendar. Tente de novo.', 'erro');
      botao.disabled = false;
      botao.textContent = 'Confirmar agendamento';
      // alguém pode ter reservado o horário enquanto ela escolhia
      try { await carregarOcupados(); } catch { /* ok */ }
      if (!horariosLivres(config, dia, servico.duracao, ocupados).some((h) => h.hora === horario.hora)) {
        escolha.horario = null;
        desenhar();
      }
    }
  } },
  el('div', { class: 'resumo' },
    el('strong', {}, escolha.servico.nome),
    el('div', {}, diaPorExtenso(escolha.dia), ' às ', escolha.horario.hora)),
  el('div', { class: 'f-field' }, el('label', { class: 'f-label', for: 'ag-nome' }, 'Seu nome'), nome),
  el('div', { class: 'f-field' }, el('label', { class: 'f-label', for: 'ag-tel' }, 'Telefone (WhatsApp)'), telefone),
  botao);

  telefone.addEventListener('input', () => {
    const d = telefone.value.replace(/\D/g, '').slice(0, 11);
    telefone.value = d.length <= 2 ? d : d.length <= 6 ? `(${d.slice(0, 2)}) ${d.slice(2)}`
      : d.length <= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  });

  return passo('4', 'Confirme seus dados', form);
}

function sucesso(servico, dia, horario, nome) {
  const quando = `${diaPorExtenso(dia)} às ${horario.hora}`;
  const msg = preencher(mensagens(config).aviso_cliente, { nome, servico: servico.nome, data: diaPorExtenso(dia), hora: horario.hora });
  corpo.replaceChildren(el('div', { class: 'thanks' },
    el('h2', {}, 'Horário reservado! 💕'),
    el('p', { class: 'resumo-final' }, el('strong', {}, servico.nome), el('br'), quando),
    el('p', { class: 'muted' }, 'Se precisar remarcar ou cancelar, é só me chamar no WhatsApp.'),
    config.whatsapp ? el('a', { class: 'btn', href: linkWhatsApp(config.whatsapp, msg), target: '_blank', rel: 'noopener' }, 'Avisar no WhatsApp') : null));
  scrollTo(0, 0);
}

iniciar();
