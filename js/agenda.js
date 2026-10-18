// Agenda da equipe: atendimentos do dia, semana, bloqueios e configuração do expediente.
import { api } from './api.js';
import { agendaPadrao, mensagens, MENSAGENS_PADRAO } from './modelo-padrao.js';
import {
  el, banner, toast, clone, instante, diaNoFuso, horaNoFuso, somaDias, diaDaSemana, nomeDoDia, diaPorExtenso,
  horariosLivres, linkWhatsApp, linkAgendamento, minutos, hhmm, preencher, primeiroNome,
} from './util.js';
import { exigirLogin, barraTopo, modal, painelEnvio } from './equipe.js';

const app = document.getElementById('app');
const STATUS = { agendado: 'Agendado', confirmado: 'Confirmado', concluido: 'Concluído', faltou: 'Faltou', cancelado: 'Cancelado' };

let pessoa;
let config;
let dia;
let semana = { de: null, itens: [] };

const cabecalhoDia = el('div', { class: 'ag-toolbar' });
const faixaSemana = el('div', { class: 'semana' });
const resumo = el('div', { class: 'ag-resumo' });
const listaDia = el('div', { class: 'ag-lista' });

exigirLogin(app, 'Agenda', async (p) => {
  pessoa = p;
  try {
    config = await api.configAgenda();
  } catch (e) {
    config = agendaPadrao();
    toast('Não foi possível carregar a configuração da agenda: ' + e.message, 'erro');
  }
  const hash = new URLSearchParams(location.hash.slice(1)).get('dia');
  dia = /^\d{4}-\d{2}-\d{2}$/.test(hash || '') ? hash : hoje();
  app.replaceChildren(banner(api) || '', barraTopo(pessoa, 'agenda'),
    el('main', { class: 'agenda' }, cabecalhoDia, faixaSemana, resumo, listaDia));
  await irPara(dia, true);
});

const hoje = () => diaNoFuso(new Date(), config.fuso);
const inicioDaSemana = (d) => somaDias(d, -((diaDaSemana(d) + 6) % 7)); // semana começa na segunda

async function irPara(novoDia, recarregar = false) {
  dia = novoDia;
  history.replaceState(null, '', '#dia=' + dia);
  const de = inicioDaSemana(dia);
  if (recarregar || semana.de !== de) {
    listaDia.replaceChildren(el('div', { class: 'vazio' }, 'Carregando…'));
    try {
      const itens = await api.listarAgenda(instante(de, '00:00', config.fuso), instante(somaDias(de, 7), '00:00', config.fuso));
      semana = { de, itens };
    } catch (e) {
      listaDia.replaceChildren(el('div', { class: 'vazio' }, 'Não foi possível carregar a agenda: ' + e.message));
      return;
    }
  }
  desenhar();
}

const doDia = (d) => semana.itens.filter((a) => diaNoFuso(a.inicio, config.fuso) === d);
const ativos = (lista) => lista.filter((a) => a.status !== 'cancelado');

function desenhar() {
  const seletor = el('input', { type: 'date', class: 'input', value: dia, 'aria-label': 'Escolher dia', onchange: (e) => e.target.value && irPara(e.target.value) });
  cabecalhoDia.replaceChildren(
    el('div', { class: 'ag-nav' },
      el('button', { class: 'icon-btn', 'aria-label': 'Dia anterior', onclick: () => irPara(somaDias(dia, -1)) }, '‹'),
      el('div', { class: 'ag-data' }, el('h1', {}, dia === hoje() ? 'Hoje' : diaPorExtenso(dia)),
        dia === hoje() ? el('div', { class: 'muted' }, diaPorExtenso(dia)) : null),
      el('button', { class: 'icon-btn', 'aria-label': 'Próximo dia', onclick: () => irPara(somaDias(dia, 1)) }, '›'),
      seletor,
      dia !== hoje() ? el('button', { class: 'btn ghost small', onclick: () => irPara(hoje()) }, 'Hoje') : null),
    el('div', { class: 'ag-acoes' },
      el('button', { class: 'btn small', onclick: () => editar() }, '+ Agendar'),
      el('button', { class: 'btn ghost small', onclick: bloquear }, 'Bloquear horário'),
      el('button', { class: 'btn ghost small', onclick: () => modal('Link de agendamento', el('div', {},
        el('p', { class: 'muted', style: 'margin-top:0' }, 'A cliente escolhe o atendimento, o dia e o horário livre, e o agendamento aparece aqui na hora. 💕'),
        painelEnvio({ opcoes: [{ titulo: 'Agendamento', url: linkAgendamento() }], modelo: mensagens(config).agendamento }))) }, 'Link de agendamento'),
      pessoa.papel === 'admin' ? el('button', { class: 'btn ghost small', onclick: configurar }, 'Horários e serviços') : null,
      el('button', { class: 'btn ghost small', title: 'Atualizar', onclick: () => irPara(dia, true) }, '↻')));

  faixaSemana.replaceChildren(...Array.from({ length: 7 }, (_, i) => {
    const d = somaDias(semana.de, i);
    const n = ativos(doDia(d)).filter((a) => a.tipo !== 'bloqueio').length;
    return el('button', { class: 'sem-dia' + (d === dia ? ' sel' : '') + (d === hoje() ? ' hoje' : ''), onclick: () => irPara(d) },
      el('span', { class: 'dia-sem' }, nomeDoDia(d, true)),
      el('span', { class: 'dia-num' }, d.slice(8, 10)),
      el('span', { class: 'dia-livres' }, n ? `${n} ${n === 1 ? 'cliente' : 'clientes'}` : '—'));
  }));

  const itens = doDia(dia);
  const atend = ativos(itens).filter((a) => a.tipo !== 'bloqueio');
  const menor = Math.min(...(config.servicos || []).map((s) => s.duracao), 60);
  const livres = horariosLivres(config, dia, menor, ativos(itens), dia === hoje() ? new Date() : new Date(0));
  const expediente = config.horarios?.[diaDaSemana(dia)] || [];
  resumo.replaceChildren(
    el('span', {}, el('strong', {}, String(atend.length)), atend.length === 1 ? ' atendimento' : ' atendimentos'),
    expediente.length
      ? el('span', {}, el('strong', {}, String(livres.length)), ` ${livres.length === 1 ? 'horário livre' : 'horários livres'} (${menor} min)`)
      : el('span', { class: 'muted' }, 'Fechado neste dia'),
    expediente.length ? el('span', { class: 'muted' }, 'Expediente: ' + expediente.map(([a, b]) => `${a}–${b}`).join(', ')) : null);

  listaDia.replaceChildren(...(itens.length ? itens.map(cartao) : [el('div', { class: 'vazio' }, 'Nenhum agendamento neste dia.')]));
}

function cartao(a) {
  const ini = horaNoFuso(a.inicio, config.fuso);
  const fim = horaNoFuso(a.fim, config.fuso);
  if (a.tipo === 'bloqueio') {
    return el('div', { class: 'ag-item bloqueio' },
      el('div', { class: 'ag-hora' }, ini, el('small', {}, fim)),
      el('div', { class: 'ag-corpo' }, el('strong', {}, '🔒 Horário bloqueado'), a.observacao ? el('div', { class: 'muted' }, a.observacao) : null),
      el('div', { class: 'ag-ops' }, el('button', { class: 'btn danger small', onclick: () => remover(a, 'Desbloquear este horário?') }, 'Desbloquear')));
  }
  const fone = a.cliente_telefone || '';
  const quando = dia === hoje() ? 'hoje, ' + diaPorExtenso(dia) : dia === somaDias(hoje(), 1) ? 'amanhã, ' + diaPorExtenso(dia) : diaPorExtenso(dia);
  const msg = preencher(mensagens(config).confirmacao, { nome: primeiroNome(a.cliente_nome), servico: a.servico, data: quando, hora: ini });
  const status = el('select', { class: 'input status-sel st-' + a.status, 'aria-label': 'Situação', onchange: async (e) => {
    try {
      await api.atualizarAgendamento(a.id, { status: e.target.value });
      a.status = e.target.value;
      toast('Situação atualizada: ' + STATUS[a.status]);
      desenhar();
    } catch (err) {
      toast(err.message, 'erro');
      e.target.value = a.status;
    }
  } }, Object.entries(STATUS).map(([v, t]) => el('option', { value: v, selected: a.status === v }, t)));

  return el('div', { class: 'ag-item st-' + a.status },
    el('div', { class: 'ag-hora' }, ini, el('small', {}, fim)),
    el('div', { class: 'ag-corpo' },
      el('div', { class: 'ag-nome' }, a.cliente_nome, a.origem === 'cliente' ? el('span', { class: 'badge vista' }, 'pelo link') : null),
      el('div', {}, a.servico),
      fone ? el('a', { class: 'btn-link', href: linkWhatsApp(fone, msg), target: '_blank', rel: 'noopener' }, '💬 ' + fone + ' · confirmar no WhatsApp') : null,
      a.ficha_id ? el('div', {}, el('a', { class: 'btn-link', href: 'profissional.html#ficha=' + a.ficha_id }, '📋 Ver ficha de anamnese')) : null,
      a.observacao ? el('div', { class: 'muted pre' }, a.observacao) : null),
    el('div', { class: 'ag-ops' }, status,
      el('button', { class: 'icon-btn', title: 'Editar', 'aria-label': 'Editar agendamento', onclick: () => editar(a) }, '✎'),
      el('button', { class: 'icon-btn', title: 'Excluir', 'aria-label': 'Excluir agendamento', onclick: () => remover(a, `Excluir o agendamento de ${a.cliente_nome}? Para manter o histórico, prefira marcar como "Cancelado".`) }, '✕')));
}

async function remover(a, pergunta) {
  if (!confirm(pergunta)) return;
  try {
    await api.excluirAgendamento(a.id);
    semana.itens = semana.itens.filter((x) => x.id !== a.id);
    desenhar();
    toast('Pronto!');
  } catch (e) {
    toast(e.message, 'erro');
  }
}

function campo(rotulo, input, classe = '') {
  return el('label', { class: 'campo-form ' + classe }, el('span', { class: 'lbl' }, rotulo), input);
}

// Novo agendamento (a) = undefined, ou edição de um existente
function editar(a) {
  const servicos = config.servicos || [];
  const atual = a ? servicos.find((s) => s.nome === a.servico) : servicos[0];
  const dDia = el('input', { class: 'input', type: 'date', value: a ? diaNoFuso(a.inicio, config.fuso) : dia, required: true });
  const dHora = el('input', { class: 'input', type: 'time', step: '300', value: a ? horaNoFuso(a.inicio, config.fuso) : '', required: true });
  const dServ = el('select', { class: 'input' },
    servicos.map((s) => el('option', { value: s.nome, selected: atual?.nome === s.nome }, s.nome)),
    el('option', { value: '', selected: !!a && !atual }, 'Outro…'));
  const dOutro = el('input', { class: 'input', placeholder: 'Ex.: Retorno', value: a && !atual ? a.servico : '' });
  const wOutro = campo('Nome do atendimento', dOutro, 'full');
  wOutro.hidden = !(a && !atual);
  const dDur = el('input', { class: 'input', type: 'number', min: '5', step: '5', required: true,
    value: String(a ? Math.round((new Date(a.fim) - new Date(a.inicio)) / 60000) : (atual?.duracao || 60)) });
  const dNome = el('input', { class: 'input', value: a?.cliente_nome || '', required: true, autocomplete: 'off' });
  const dTel = el('input', { class: 'input', type: 'tel', value: a?.cliente_telefone || '', autocomplete: 'off' });
  const dObs = el('textarea', { class: 'input', rows: '2', value: a?.observacao || '' });
  dServ.addEventListener('change', () => {
    const s = servicos.find((x) => x.nome === dServ.value);
    wOutro.hidden = !!s;
    if (s) dDur.value = String(s.duracao);
  });

  let fechar;
  const form = el('form', { class: 'form-grid', onsubmit: async (e) => {
    e.preventDefault();
    const servico = dServ.value || dOutro.value.trim();
    if (!servico) return toast('Informe o atendimento', 'erro');
    const inicio = instante(dDia.value, dHora.value, config.fuso);
    const linha = {
      inicio: inicio.toISOString(),
      fim: new Date(+inicio + Number(dDur.value) * 60000).toISOString(),
      servico,
      cliente_nome: dNome.value.trim(),
      cliente_telefone: dTel.value.trim() || null,
      observacao: dObs.value.trim() || null,
    };
    try {
      if (a) await api.atualizarAgendamento(a.id, linha);
      else await api.criarAgendamento({ ...linha, tipo: 'atendimento', origem: 'equipe' });
      fechar();
      toast(a ? 'Agendamento atualizado' : 'Agendamento criado');
      await irPara(dDia.value, true);
    } catch (err) {
      toast(err.message, 'erro');
    }
  } },
  campo('Dia', dDia), campo('Horário', dHora),
  campo('Atendimento', dServ), campo('Duração (minutos)', dDur),
  wOutro,
  campo('Nome da cliente', dNome, 'full'), campo('Telefone', dTel, 'full'),
  campo('Observação', dObs, 'full'),
  el('div', { class: 'full form-acoes' }, el('button', { class: 'btn', type: 'submit' }, a ? 'Salvar alterações' : 'Agendar')));
  fechar = modal(a ? 'Editar agendamento' : 'Novo agendamento', form);
  (a ? dNome : dHora).focus();
}

function bloquear() {
  const exp = config.horarios?.[diaDaSemana(dia)] || [];
  const dDia = el('input', { class: 'input', type: 'date', value: dia, required: true });
  const dDe = el('input', { class: 'input', type: 'time', step: '300', value: exp[0]?.[0] || '09:00', required: true });
  const dAte = el('input', { class: 'input', type: 'time', step: '300', value: exp.at(-1)?.[1] || '18:00', required: true });
  const dMotivo = el('input', { class: 'input', placeholder: 'Ex.: curso, consulta médica, feriado…' });
  let fechar;
  const form = el('form', { class: 'form-grid', onsubmit: async (e) => {
    e.preventDefault();
    if (minutos(dAte.value) <= minutos(dDe.value)) return toast('O fim precisa ser depois do início', 'erro');
    try {
      await api.criarAgendamento({
        tipo: 'bloqueio', origem: 'equipe', servico: 'Bloqueio', cliente_nome: 'Horário bloqueado',
        inicio: instante(dDia.value, dDe.value, config.fuso).toISOString(),
        fim: instante(dDia.value, dAte.value, config.fuso).toISOString(),
        observacao: dMotivo.value.trim() || null,
      });
      fechar();
      toast('Horário bloqueado: clientes não conseguem agendar nesse período');
      await irPara(dDia.value, true);
    } catch (err) {
      toast(err.message === 'Já existe um agendamento nesse horário.' ? 'Já existe agendamento nesse período. Remarque ou cancele antes de bloquear.' : err.message, 'erro');
    }
  } },
  campo('Dia', dDia, 'full'), campo('De', dDe), campo('Até', dAte), campo('Motivo (opcional)', dMotivo, 'full'),
  el('div', { class: 'full form-acoes' }, el('button', { class: 'btn', type: 'submit' }, 'Bloquear')));
  fechar = modal('Bloquear horário', form);
}

function configurar() {
  const c = clone(config);
  const SEMANA = [1, 2, 3, 4, 5, 6, 0];
  const linhasDias = SEMANA.map((d) => {
    const input = el('input', { class: 'input', placeholder: 'Fechado', value: (c.horarios?.[d] || []).map(([a, b]) => `${a}-${b}`).join(', ') });
    return { d, input, node: campo(nomeDoDia(somaDias('2026-10-18', d)), input) }; // 18/10/2026 é domingo
  });
  const servicos = el('textarea', { class: 'input', rows: '4', value: (c.servicos || []).map((s) => `${s.nome} | ${s.duracao}`).join('\n') });
  const whats = el('input', { class: 'input', type: 'tel', value: c.whatsapp || '', placeholder: '(00) 00000-0000' });
  const mensagem = el('input', { class: 'input', value: c.mensagem || '' });
  const intervalo = el('select', { class: 'input' }, [15, 20, 30, 45, 60].map((n) => el('option', { value: String(n), selected: Number(c.intervalo) === n }, `A cada ${n} min`)));
  const antecedencia = el('input', { class: 'input', type: 'number', min: '0', value: String(c.antecedencia_horas ?? 2) });
  const diasFrente = el('input', { class: 'input', type: 'number', min: '1', max: '60', value: String(c.dias_a_frente ?? 30) });
  const msgs = mensagens(c);
  const textosMsg = Object.fromEntries(Object.keys(MENSAGENS_PADRAO).map((k) => [k, el('textarea', { class: 'input', rows: '7', value: msgs[k] })]));
  const restaurar = el('button', { type: 'button', class: 'btn-link', onclick: () => {
    if (!confirm('Voltar todas as mensagens para o texto sugerido?')) return;
    for (const [k, t] of Object.entries(textosMsg)) t.value = MENSAGENS_PADRAO[k];
  } }, 'Restaurar mensagens sugeridas');

  let fechar;
  const form = el('form', { class: 'form-grid', onsubmit: async (e) => {
    e.preventDefault();
    const horarios = {};
    for (const { d, input } of linhasDias) {
      const partes = input.value.split(',').map((x) => x.trim()).filter(Boolean);
      const faixas = [];
      for (const p of partes) {
        const m = /^(\d{1,2})(?:[:h](\d{2}))?h?\s*(?:-|–|às|as|a|até)\s*(\d{1,2})(?:[:h](\d{2}))?h?$/i.exec(p);
        if (!m) return toast(`Não entendi "${p}" em ${nomeDoDia(somaDias('2026-10-18', d))}. Use o formato 09:00-12:00`, 'erro');
        const de = hhmm(Number(m[1]) * 60 + Number(m[2] || 0));
        const ate = hhmm(Number(m[3]) * 60 + Number(m[4] || 0));
        if (minutos(ate) <= minutos(de) || minutos(ate) > 24 * 60) return toast(`Horário inválido: "${p}"`, 'erro');
        faixas.push([de, ate]);
      }
      horarios[d] = faixas.sort((x, y) => minutos(x[0]) - minutos(y[0]));
    }
    const lista = [];
    for (const linha of servicos.value.split('\n').map((x) => x.trim()).filter(Boolean)) {
      const [nome, dur] = linha.split('|').map((x) => x.trim());
      if (!nome || !(Number(dur) > 0)) return toast(`Serviço "${linha}": use o formato Nome | minutos`, 'erro');
      lista.push({ nome, duracao: Math.round(Number(dur)) });
    }
    if (!lista.length) return toast('Cadastre pelo menos um serviço', 'erro');
    const novo = {
      ...c, horarios, servicos: lista, whatsapp: whats.value.trim(), mensagem: mensagem.value.trim(),
      intervalo: Number(intervalo.value), antecedencia_horas: Math.max(0, Number(antecedencia.value) || 0),
      dias_a_frente: Math.min(60, Math.max(1, Number(diasFrente.value) || 30)),
      mensagens: Object.fromEntries(Object.entries(textosMsg).map(([k, t]) => [k, t.value.trim() || MENSAGENS_PADRAO[k]])),
    };
    try {
      await api.salvarConfigAgenda(novo);
      config = novo;
      fechar();
      toast('Configuração salva! A página de agendamento já usa os novos horários.');
      desenhar();
    } catch (err) {
      toast('Não foi possível salvar: ' + err.message, 'erro');
    }
  } },
  el('h3', { class: 'full' }, 'Expediente'),
  el('p', { class: 'full muted', style: 'margin:0' }, 'Use vírgula para separar períodos (ex.: almoço): 09:00-12:00, 13:00-18:00. Deixe vazio nos dias fechados.'),
  linhasDias.map((x) => x.node),
  el('h3', { class: 'full' }, 'Serviços'),
  campo('Um por linha: Nome | duração em minutos', servicos, 'full'),
  el('h3', { class: 'full' }, 'Regras'),
  campo('Horários oferecidos', intervalo),
  campo('Antecedência mínima (horas)', antecedencia),
  campo('Agenda aberta para os próximos (dias)', diasFrente),
  campo('Seu WhatsApp (a cliente pode te avisar depois de agendar)', whats),
  campo('Mensagem na página de agendamento', mensagem, 'full'),
  el('h3', { class: 'full' }, 'Mensagens de WhatsApp'),
  el('p', { class: 'full muted', style: 'margin:0' },
    'Escreva do seu jeitinho, com emojis à vontade. O app troca sozinho: {nome} (primeiro nome da cliente), {servico}, {data}, {hora} e {link}.'),
  campo('Confirmação de horário (você → cliente)', textosMsg.confirmacao, 'full'),
  campo('Envio da ficha de anamnese (você → cliente)', textosMsg.ficha, 'full'),
  campo('Envio do link de agendamento (você → cliente)', textosMsg.agendamento, 'full'),
  campo('Aviso depois de agendar (cliente → você)', textosMsg.aviso_cliente, 'full'),
  el('div', { class: 'full' }, restaurar),
  el('div', { class: 'full form-acoes' }, el('button', { class: 'btn', type: 'submit' }, 'Salvar configuração')));
  fechar = modal('Horários e serviços', form);
}
