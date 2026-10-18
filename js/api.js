// Camada de dados: conversa com o Supabase ou, se ele ainda não estiver
// configurado, com um "banco" de demonstração guardado no navegador.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=202610180432';
import { modeloPadrao, agendaPadrao } from './modelo-padrao.js?v=202610180432';
import { alertas, dadosDaCliente } from './render.js?v=202610180432';
import { uid, clone } from './util.js?v=202610180432';

const demo = !SUPABASE_URL || !SUPABASE_ANON_KEY;

function linhaDaFicha(form, answers) {
  const cliente = dadosDaCliente(form.schema, answers);
  return {
    id: crypto.randomUUID(),
    form_id: form.id,
    form_title: form.title,
    form_schema: form.schema,
    answers,
    client_name: cliente.nome.slice(0, 200) || 'Sem nome',
    client_phone: cliente.telefone.slice(0, 40),
    alertas: alertas(form.schema, answers).map((a) => a.label),
  };
}

// ------------------------------------------------------------------ Supabase

function supabaseApi() {
  let cliente;
  const sb = async () => {
    if (!cliente) {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
      cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return cliente;
  };
  const conflito = (e) => (/agendamentos_sem_conflito|exclusion/i.test(e.message)
    ? new Error('Já existe um agendamento nesse horário.') : e);
  const ok = ({ data, error }) => {
    if (error) {
      if (error.code === '23505') throw new Error('Já existe uma ficha com esse endereço de link. Escolha outro.');
      throw new Error(error.message);
    }
    return data;
  };
  const equipe = async (s, user) => {
    const linha = ok(await s.from('staff').select('nome, papel').eq('user_id', user.id).maybeSingle());
    if (!linha) return null;
    return { email: user.email, nome: linha.nome || user.email, papel: linha.papel };
  };

  return {
    demo: false,

    async fichaPublica(slug) {
      const s = await sb();
      let q = s.from('forms').select('id, slug, title, schema').eq('active', true);
      if (slug) q = q.eq('slug', slug);
      const linhas = ok(await q.order('created_at').limit(1));
      return linhas[0] || null;
    },

    async enviar(form, answers) {
      const s = await sb();
      // sem .select(): a cliente não tem permissão de ler fichas, só de enviar
      const linha = linhaDaFicha(form, answers);
      ok(await s.from('submissions').insert(linha));
      return { id: linha.id, nome: linha.client_name, telefone: linha.client_phone };
    },

    async entrar(email, senha) {
      const s = await sb();
      const { user } = ok(await s.auth.signInWithPassword({ email, password: senha }));
      const pessoa = await equipe(s, user);
      if (!pessoa) {
        await s.auth.signOut();
        throw new Error('Este e-mail ainda não foi liberado para acessar o painel.');
      }
      return pessoa;
    },

    async sair() {
      await (await sb()).auth.signOut();
    },

    async sessao() {
      const s = await sb();
      const { session } = ok(await s.auth.getSession());
      return session ? equipe(s, session.user) : null;
    },

    async listarFormularios() {
      return ok(await (await sb()).from('forms').select('*').order('created_at'));
    },

    async salvarFormulario(form) {
      const s = await sb();
      const linha = { title: form.title, slug: form.slug, active: form.active, schema: form.schema, updated_at: new Date().toISOString() };
      const q = form.id ? s.from('forms').update(linha).eq('id', form.id) : s.from('forms').insert(linha);
      return ok(await q.select().single());
    },

    async excluirFormulario(id) {
      ok(await (await sb()).from('forms').delete().eq('id', id));
    },

    async listarFichas() {
      return ok(await (await sb()).from('submissions')
        .select('id, form_id, form_title, client_name, client_phone, status, alertas, created_at')
        .order('created_at', { ascending: false }).limit(1000));
    },

    async ficha(id) {
      return ok(await (await sb()).from('submissions').select('*').eq('id', id).single());
    },

    async atualizarFicha(id, mudancas) {
      ok(await (await sb()).from('submissions').update(mudancas).eq('id', id));
    },

    async excluirFicha(id) {
      ok(await (await sb()).from('submissions').delete().eq('id', id));
    },

    // ---- agenda
    async configAgenda() {
      const linha = ok(await (await sb()).from('agenda_config').select('config').eq('id', 1).maybeSingle());
      return linha?.config || agendaPadrao();
    },

    async salvarConfigAgenda(config) {
      ok(await (await sb()).from('agenda_config').update({ config, updated_at: new Date().toISOString() }).eq('id', 1));
    },

    async horariosOcupados(de, ate) {
      return ok(await (await sb()).rpc('horarios_ocupados', { p_de: de.toISOString(), p_ate: ate.toISOString() }));
    },

    async agendar({ inicio, servico, nome, telefone, ficha }) {
      return ok(await (await sb()).rpc('agendar', {
        p_inicio: inicio.toISOString(), p_servico: servico, p_nome: nome, p_telefone: telefone, p_ficha: ficha || null,
      }));
    },

    async listarAgenda(de, ate) {
      return ok(await (await sb()).from('agendamentos').select('*')
        .lt('inicio', ate.toISOString()).gt('fim', de.toISOString()).order('inicio'));
    },

    async agendamentosDaFicha(fichaId) {
      return ok(await (await sb()).from('agendamentos').select('*').eq('ficha_id', fichaId).order('inicio'));
    },

    async criarAgendamento(linha) {
      try {
        ok(await (await sb()).from('agendamentos').insert(linha));
      } catch (e) {
        throw conflito(e);
      }
    },

    async atualizarAgendamento(id, mudancas) {
      try {
        ok(await (await sb()).from('agendamentos').update(mudancas).eq('id', id));
      } catch (e) {
        throw conflito(e);
      }
    },

    async excluirAgendamento(id) {
      ok(await (await sb()).from('agendamentos').delete().eq('id', id));
    },
  };
}

// ------------------------------------------------------------ Demonstração

function demoApi() {
  const CHAVE = 'regenera_demo_v1';
  const ler = () => {
    let dados;
    try { dados = JSON.parse(localStorage.getItem(CHAVE)); } catch { /* vazio */ }
    if (!dados) {
      const m = modeloPadrao();
      dados = { forms: [{ id: uid('f'), slug: 'anamnese', title: m.title, active: true, schema: m, created_at: new Date().toISOString() }], submissions: [] };
      gravar(dados);
    }
    return dados;
  };
  const gravar = (dados) => {
    try { localStorage.setItem(CHAVE, JSON.stringify(dados)); } catch { /* sem armazenamento */ }
  };
  const altera = (fn) => { const d = ler(); const r = fn(d); gravar(d); return r; };
  const espera = () => new Promise((r) => setTimeout(r, 150));
  const AUTH = 'regenera_demo_auth';
  const ativos = (d) => (d.agendamentos || []).filter((a) => a.status !== 'cancelado');
  const sobrepoe = (d, novo) => novo.status !== 'cancelado' &&
    ativos(d).some((a) => a.id !== novo.id && a.inicio < novo.fim && a.fim > novo.inicio);

  return {
    demo: true,

    async fichaPublica(slug) {
      await espera();
      return clone(ler().forms.find((f) => f.active && (!slug || f.slug === slug)) || null);
    },

    async enviar(form, answers) {
      await espera();
      const linha = { ...linhaDaFicha(form, answers), status: 'nova', sessions: [], notes: null, created_at: new Date().toISOString() };
      altera((d) => d.submissions.unshift(linha));
      return { id: linha.id, nome: linha.client_name, telefone: linha.client_phone };
    },

    async entrar(email) {
      const pessoa = { email, nome: 'Demonstração', papel: 'admin' };
      sessionStorage.setItem(AUTH, JSON.stringify(pessoa));
      return pessoa;
    },

    async sair() { sessionStorage.removeItem(AUTH); },

    async sessao() {
      try { return JSON.parse(sessionStorage.getItem(AUTH)); } catch { return null; }
    },

    async listarFormularios() { return clone(ler().forms); },

    async salvarFormulario(form) {
      await espera();
      return altera((d) => {
        if (d.forms.some((f) => f.slug === form.slug && f.id !== form.id)) {
          throw new Error('Já existe uma ficha com esse endereço de link. Escolha outro.');
        }
        const linha = { ...clone(form), updated_at: new Date().toISOString() };
        if (!linha.id) {
          linha.id = uid('f');
          linha.created_at = linha.updated_at;
          d.forms.push(linha);
        } else {
          d.forms[d.forms.findIndex((f) => f.id === linha.id)] = linha;
        }
        return clone(linha);
      });
    },

    async excluirFormulario(id) {
      altera((d) => { d.forms = d.forms.filter((f) => f.id !== id); });
    },

    async listarFichas() {
      await espera();
      return ler().submissions.map(({ answers, form_schema, ...resto }) => resto);
    },

    async ficha(id) { return clone(ler().submissions.find((s) => s.id === id)); },

    async atualizarFicha(id, mudancas) {
      altera((d) => Object.assign(d.submissions.find((s) => s.id === id), clone(mudancas)));
    },

    async excluirFicha(id) {
      altera((d) => { d.submissions = d.submissions.filter((s) => s.id !== id); });
    },

    // ---- agenda (mesmas regras da função agendar() do banco)
    async configAgenda() { return clone(ler().agendaConfig || agendaPadrao()); },

    async salvarConfigAgenda(config) { altera((d) => { d.agendaConfig = clone(config); }); },

    async horariosOcupados(de, ate) {
      await espera();
      return ativos(ler()).filter((a) => a.inicio < ate.toISOString() && a.fim > de.toISOString()).map(({ inicio, fim }) => ({ inicio, fim }));
    },

    async agendar({ inicio, servico, nome, telefone, ficha }) {
      await espera();
      const c = ler().agendaConfig || agendaPadrao();
      const s = c.servicos.find((x) => x.nome === servico);
      if (!s) throw new Error('Serviço inválido.');
      if (!nome.trim() || telefone.replace(/\D/g, '').length < 10) throw new Error('Informe seu nome e telefone com DDD.');
      const linha = {
        inicio: inicio.toISOString(), fim: new Date(+inicio + s.duracao * 60000).toISOString(), servico,
        cliente_nome: nome.trim(), cliente_telefone: telefone, ficha_id: ficha || null, origem: 'cliente',
      };
      return this.criarAgendamento(linha, 'Esse horário acabou de ser reservado. Escolha outro, por favor.');
    },

    async listarAgenda(de, ate) {
      await espera();
      return ler().agendamentos?.filter((a) => a.inicio < ate.toISOString() && a.fim > de.toISOString())
        .sort((a, b) => a.inicio.localeCompare(b.inicio)) || [];
    },

    async agendamentosDaFicha(fichaId) {
      return (ler().agendamentos || []).filter((a) => a.ficha_id === fichaId).sort((a, b) => a.inicio.localeCompare(b.inicio));
    },

    async criarAgendamento(linha, msgConflito = 'Já existe um agendamento nesse horário.') {
      return altera((d) => {
        const novo = { id: uid('a'), tipo: 'atendimento', status: 'agendado', origem: 'equipe', observacao: null, created_at: new Date().toISOString(), ...clone(linha) };
        if (sobrepoe(d, novo)) throw new Error(msgConflito);
        (d.agendamentos ||= []).push(novo);
        return novo.id;
      });
    },

    async atualizarAgendamento(id, mudancas) {
      altera((d) => {
        const a = d.agendamentos.find((x) => x.id === id);
        const novo = { ...a, ...clone(mudancas) };
        if (sobrepoe(d, novo)) throw new Error('Já existe um agendamento nesse horário.');
        Object.assign(a, novo);
      });
    },

    async excluirAgendamento(id) {
      altera((d) => { d.agendamentos = d.agendamentos.filter((a) => a.id !== id); });
    },
  };
}

export const api = demo ? demoApi() : supabaseApi();
