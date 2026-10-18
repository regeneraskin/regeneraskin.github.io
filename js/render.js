// Desenha o questionário (para a cliente e para a pré-visualização do editor)
// e formata as respostas (para o painel da profissional).
import { el, uid, dataCurta } from './util.js?v=202610181407';

export const TIPOS = {
  short: 'Resposta curta',
  long: 'Resposta longa',
  date: 'Data',
  yesno: 'Sim / Não',
  choice: 'Escolha uma opção',
  multi: 'Marque várias opções',
  consent: 'Termo / aceite',
  signature: 'Assinatura',
  info: 'Texto informativo (sem resposta)',
};

export const FORMATOS = {
  texto: 'Texto livre',
  nome: 'Nome da cliente',
  telefone: 'Telefone',
  cpf: 'CPF',
  email: 'E-mail',
  numero: 'Número',
};

export function renderForm(root, schema) {
  root.replaceChildren();
  const campos = [];
  for (const sec of schema.sections || []) {
    const bloco = el('section', { class: 'f-section' });
    if (sec.title) bloco.append(el('h2', { class: 'f-section-title', text: sec.title }));
    for (const f of sec.fields || []) {
      const c = renderField(f);
      bloco.append(c.node);
      if (c.get) campos.push({ f, ...c });
    }
    root.append(bloco);
  }
  return {
    collect() {
      const answers = {};
      const errors = [];
      for (const { f, node, get } of campos) {
        const v = get();
        answers[f.id] = v;
        const erro = f.required && vazio(f, v) ? 'Campo obrigatório' : (!vazio(f, v) && invalido(f, v)) || '';
        node.classList.toggle('has-error', !!erro);
        node.querySelector('.f-error').textContent = erro;
        if (erro) errors.push(node);
      }
      return { answers, errors };
    },
  };
}

function vazio(f, v) {
  if (f.type === 'yesno') return !v || !v.valor;
  if (f.type === 'consent') return v !== true;
  if (Array.isArray(v)) return v.length === 0;
  return v == null || String(v).trim() === '';
}

function invalido(f, v) {
  if (f.type !== 'short') return '';
  const digitos = String(v).replace(/\D/g, '');
  if (f.format === 'cpf' && !cpfValido(digitos)) return 'CPF inválido';
  if (f.format === 'telefone' && (digitos.length < 10 || digitos.length > 11)) return 'Telefone incompleto (inclua o DDD)';
  if (f.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'E-mail inválido';
  return '';
}

function cpfValido(d) {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(d[n])) return false;
  }
  return true;
}

function mascara(format, valor) {
  const d = valor.replace(/\D/g, '');
  if (format === 'cpf') {
    return d.slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  if (format === 'telefone') {
    const t = d.slice(0, 11);
    if (t.length <= 2) return t;
    if (t.length <= 6) return `(${t.slice(0, 2)}) ${t.slice(2)}`;
    if (t.length <= 10) return `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`;
    return `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`;
  }
  return valor;
}

function renderField(f) {
  const nome = 'q_' + f.id + '_' + uid('r');
  const idInput = nome + '_in';

  if (f.type === 'info') {
    return { node: el('div', { class: 'f-info' }, f.label) };
  }

  const titulo = (forId) => el(forId ? 'label' : 'div', { class: 'f-label', for: forId || null },
    f.label, f.required ? el('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null);
  const ajuda = f.help ? el('div', { class: 'f-help' }, f.help) : null;
  const erro = el('div', { class: 'f-error', 'aria-live': 'polite' });
  const wrap = (...filhos) => el('div', { class: 'f-field f-' + f.type }, ...filhos, erro);

  switch (f.type) {
    case 'short': {
      const tipos = { telefone: 'tel', email: 'email', numero: 'number' };
      const input = el('input', {
        id: idInput, type: tipos[f.format] || 'text', class: 'input', required: !!f.required,
        autocomplete: { nome: 'name', telefone: 'tel', email: 'email' }[f.format] || 'off',
        inputmode: f.format === 'cpf' ? 'numeric' : null,
      });
      if (f.format === 'cpf' || f.format === 'telefone') {
        input.addEventListener('input', () => (input.value = mascara(f.format, input.value)));
      }
      return { node: wrap(titulo(idInput), ajuda, input), get: () => input.value.trim() };
    }
    case 'long': {
      const ta = el('textarea', { id: idInput, class: 'input', rows: '3', required: !!f.required });
      return { node: wrap(titulo(idInput), ajuda, ta), get: () => ta.value.trim() };
    }
    case 'date': {
      const input = el('input', { id: idInput, type: 'date', class: 'input', required: !!f.required });
      return { node: wrap(titulo(idInput), ajuda, input), get: () => input.value };
    }
    case 'yesno': {
      const detalhe = el('input', { type: 'text', class: 'input f-detail', placeholder: f.detailLabel || 'Qual?', hidden: true, 'aria-label': f.detailLabel || 'Qual?' });
      const opcao = (valor, texto) => el('label', { class: 'pill' },
        el('input', { type: 'radio', name: nome, value: valor, onchange: () => (detalhe.hidden = !(f.detail && valor === 'sim')) }),
        el('span', {}, texto));
      const grupo = el('div', { class: 'pills', role: 'radiogroup' }, opcao('sim', 'Sim'), opcao('nao', 'Não'));
      const node = wrap(el('div', { class: 'yesno-row' }, titulo(), grupo), ajuda, f.detail ? detalhe : null);
      return {
        node,
        get: () => {
          const marcado = node.querySelector(`input[name="${nome}"]:checked`);
          if (!marcado) return null;
          const r = { valor: marcado.value };
          if (f.detail && marcado.value === 'sim' && detalhe.value.trim()) r.detalhe = detalhe.value.trim();
          return r;
        },
      };
    }
    case 'choice':
    case 'multi': {
      const tipo = f.type === 'choice' ? 'radio' : 'checkbox';
      const lista = el('div', { class: 'options' + (f.options?.length > 6 ? ' cols' : '') },
        (f.options || []).map((o) => el('label', { class: 'option' }, el('input', { type: tipo, name: nome, value: o }), el('span', {}, o))));
      const node = wrap(titulo(), ajuda, lista);
      return {
        node,
        get: () => {
          const v = [...node.querySelectorAll(`input[name="${nome}"]:checked`)].map((i) => i.value);
          return f.type === 'choice' ? (v[0] || '') : v;
        },
      };
    }
    case 'consent': {
      const cb = el('input', { type: 'checkbox', id: idInput });
      return {
        node: wrap(el('label', { class: 'consent', for: idInput }, cb,
          el('span', {}, f.label, f.required ? el('span', { class: 'req' }, ' *') : null)), ajuda),
        get: () => cb.checked,
      };
    }
    case 'signature': {
      const pad = assinatura();
      return { node: wrap(titulo(), ajuda, pad.node), get: pad.get };
    }
    default:
      return { node: el('div') };
  }
}

function assinatura() {
  const canvas = el('canvas', { class: 'sig-canvas', width: '700', height: '220', 'aria-label': 'Área para assinatura' });
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#3b2a24';
  let desenhou = false;
  let ultimo = null;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
  };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    ultimo = pos(e);
    ctx.beginPath();
    ctx.arc(ultimo.x, ultimo.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
    desenhou = true;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!ultimo) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(ultimo.x, ultimo.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo = p;
  });
  const fim = () => (ultimo = null);
  canvas.addEventListener('pointerup', fim);
  canvas.addEventListener('pointercancel', fim);
  const limpar = el('button', { type: 'button', class: 'btn-link', onclick: () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    desenhou = false;
  } }, 'Limpar assinatura');
  return {
    node: el('div', { class: 'sig' }, canvas, el('div', { class: 'sig-line' }, limpar)),
    get: () => (desenhou ? canvas.toDataURL('image/png') : ''),
  };
}

// ---------- Leitura das respostas (painel da profissional) ----------

export function camposComResposta(schema) {
  return (schema.sections || []).flatMap((s) => s.fields || []).filter((f) => f.type !== 'info');
}

// Perguntas marcadas como "alerta" que a cliente respondeu SIM
export function alertas(schema, answers) {
  return camposComResposta(schema)
    .filter((f) => f.type === 'yesno' && f.alert && answers?.[f.id]?.valor === 'sim')
    .map((f) => ({ label: f.label, detalhe: answers[f.id].detalhe || '' }));
}

export function dadosDaCliente(schema, answers) {
  const campos = camposComResposta(schema);
  const pega = (formato) => {
    const f = campos.find((c) => c.type === 'short' && c.format === formato);
    return f ? String(answers?.[f.id] || '') : '';
  };
  return { nome: pega('nome'), telefone: pega('telefone') };
}

export function respostaTexto(f, v) {
  switch (f.type) {
    case 'yesno':
      if (!v?.valor) return '';
      return (v.valor === 'sim' ? 'Sim' : 'Não') + (v.detalhe ? ' — ' + v.detalhe : '');
    case 'multi':
      return Array.isArray(v) ? v.join(', ') : '';
    case 'consent':
      return v === true ? 'Aceito' : 'Não aceito';
    case 'signature':
      return v ? 'Assinada' : '';
    case 'date':
      return v ? dataCurta(v) : '';
    default:
      return v == null ? '' : String(v);
  }
}

export function respostaView(f, v) {
  const nada = el('span', { class: 'muted' }, '—');
  switch (f.type) {
    case 'yesno':
      if (!v?.valor) return nada;
      return el('span', { class: 'resp ' + (v.valor === 'sim' ? (f.alert ? 'sim alerta' : 'sim') : 'nao') },
        v.valor === 'sim' ? 'Sim' : 'Não', v.detalhe ? el('span', { class: 'resp-detalhe' }, ' — ' + v.detalhe) : null);
    case 'multi':
      return Array.isArray(v) && v.length ? el('span', {}, v.join(', ')) : nada;
    case 'consent':
      return v === true ? el('span', { class: 'resp ok' }, '✓ Aceito') : el('span', { class: 'resp sim alerta' }, '✗ Não aceito');
    case 'signature':
      return v && /^data:image\/png;base64,/.test(v) ? el('img', { class: 'sig-img', src: v, alt: 'Assinatura da cliente' }) : nada;
    case 'date':
      return v ? el('span', {}, dataCurta(v)) : nada;
    default:
      return v ? el('span', { class: 'pre' }, String(v)) : nada;
  }
}
