// Pequenos utilitários compartilhados pelas três páginas.

// Cria um elemento: el('div', { class: 'x', onclick: fn }, filho1, 'texto', ...)
// Strings viram texto (nunca HTML), então respostas das clientes são seguras.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'value') node.value = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (typeof v === 'boolean') node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : String(c));
  }
  return node;
}

export function uid(prefixo = 'c') {
  return prefixo + '_' + Math.random().toString(36).slice(2, 9);
}

export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function slugify(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function dataHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function dataCurta(iso) {
  if (!iso) return '';
  // datas "AAAA-MM-DD" vindas de <input type=date> não têm fuso: formata direto
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function linkDaFicha(slug) {
  return new URL('index.html?f=' + encodeURIComponent(slug), location.href).href;
}

let toastTimer;
export function toast(msg, tipo = '') {
  let t = document.getElementById('toast');
  if (!t) {
    t = el('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(t);
  }
  t.textContent = msg;
  t.className = 'show ' + tipo;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ''), 3200);
}

export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    toast('Link copiado!');
  } catch {
    prompt('Copie o link:', texto);
  }
}

export function banner(api) {
  if (!api.demo) return null;
  return el('div', { class: 'demo-banner' },
    'Modo demonstração: os dados ficam salvos só neste navegador. Veja o README para ligar o app ao Supabase.');
}

// ---------- Datas no fuso da agenda ----------
// "dia" = 'AAAA-MM-DD' e "hora" = 'HH:MM', sempre no fuso da agenda
// (America/Sao_Paulo), independentemente do fuso do aparelho.

function partes(data, fuso) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-US', {
    timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(data)) p[x.type] = x.value;
  return p;
}

export function instante(dia, hora, fuso) {
  const [a, m, d] = dia.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  const palpite = Date.UTC(a, m - 1, d, h, mi);
  const p = partes(new Date(palpite), fuso);
  const deslocamento = Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - palpite;
  return new Date(palpite - deslocamento);
}

export function diaNoFuso(data, fuso) {
  const p = partes(new Date(data), fuso);
  return `${p.year}-${p.month}-${p.day}`;
}

export function horaNoFuso(data, fuso) {
  const p = partes(new Date(data), fuso);
  return `${p.hour}:${p.minute}`;
}

export function somaDias(dia, n) {
  const d = new Date(dia + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diaDaSemana(dia) {
  return new Date(dia + 'T12:00:00Z').getUTCDay();
}

export function minutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function hhmm(min) {
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
}

const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function nomeDoDia(dia, curto = false) {
  const s = SEMANA[diaDaSemana(dia)];
  return curto ? s.slice(0, 3) : s;
}

export function diaPorExtenso(dia) {
  const [, m, d] = dia.split('-').map(Number);
  return `${nomeDoDia(dia)}, ${d} de ${MESES[m - 1]}`;
}

export function linkWhatsApp(numero, msg) {
  let d = String(numero || '').replace(/\D/g, '');
  if (d && !/^55\d{10,11}$/.test(d)) d = '55' + d;
  return 'https://wa.me/' + d + (msg ? '?text=' + encodeURIComponent(msg) : '');
}

export function linkAgendamento() {
  return new URL('agendamento.html', location.href).href;
}

// Horários livres de um dia: lista de { hora, inicio: Date }
export function horariosLivres(config, dia, duracao, ocupados, agora = new Date()) {
  const limite = +agora + (Number(config.antecedencia_horas) || 0) * 3600000;
  const passo = Number(config.intervalo) || 30;
  const livres = [];
  for (const [de, ate] of config.horarios?.[diaDaSemana(dia)] || []) {
    for (let t = minutos(de); t + duracao <= minutos(ate); t += passo) {
      const inicio = instante(dia, hhmm(t), config.fuso);
      const fim = +inicio + duracao * 60000;
      if (+inicio < limite) continue;
      if (ocupados.some((o) => new Date(o.inicio) < fim && new Date(o.fim) > inicio)) continue;
      livres.push({ hora: hhmm(t), inicio });
    }
  }
  return livres;
}
