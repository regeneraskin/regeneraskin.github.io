-- Banco de dados do app de fichas de anamnese.
-- Cole este arquivo inteiro no Supabase (SQL Editor → New query → Run).
--
-- Quem pode o quê:
--   * Clientes (sem login): leem a ficha ativa e ENVIAM respostas. Não
--     conseguem ver nenhuma ficha enviada, nem a própria.
--   * Profissionais (login + cadastro na tabela staff): veem e acompanham
--     as fichas enviadas.
--   * Administradoras (papel 'admin'): tudo isso + editam os questionários,
--     excluem fichas e cadastram a equipe.

create extension if not exists pgcrypto;

-- Funções auxiliares das regras ficam num schema que não aparece na API.
create schema if not exists privado;
grant usage on schema privado to anon, authenticated;

-- Equipe ------------------------------------------------------------------
create table if not exists public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nome       text,
  papel      text not null default 'profissional' check (papel in ('admin', 'profissional')),
  created_at timestamptz not null default now()
);

create or replace function privado.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

create or replace function privado.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and papel = 'admin');
$$;

-- Questionários -----------------------------------------------------------
create table if not exists public.forms (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title      text not null,
  active     boolean not null default true,
  schema     jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fichas preenchidas ------------------------------------------------------
-- form_schema guarda uma cópia do questionário do momento do envio: se você
-- editar ou excluir o questionário depois, as fichas antigas continuam legíveis.
create table if not exists public.submissions (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid references public.forms (id) on delete set null,
  form_title   text not null check (char_length(form_title) <= 300),
  form_schema  jsonb not null,
  answers      jsonb not null check (octet_length(answers::text) < 400000),
  client_name  text not null check (char_length(client_name) <= 200),
  client_phone text check (char_length(client_phone) <= 40),
  alertas      jsonb not null default '[]'::jsonb,
  status       text not null default 'nova' check (status in ('nova', 'vista', 'arquivada')),
  sessions     jsonb not null default '[]'::jsonb,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists submissions_created_at_idx on public.submissions (created_at desc);
create index if not exists submissions_form_id_idx on public.submissions (form_id);

-- Segurança (Row Level Security) ------------------------------------------
alter table public.staff       enable row level security;
alter table public.forms       enable row level security;
alter table public.submissions enable row level security;

drop policy if exists staff_ler on public.staff;
create policy staff_ler on public.staff for select to authenticated
  using (user_id = auth.uid() or privado.is_admin());

drop policy if exists staff_admin on public.staff;
create policy staff_admin on public.staff for all to authenticated
  using (privado.is_admin()) with check (privado.is_admin());

drop policy if exists forms_ler on public.forms;
create policy forms_ler on public.forms for select to anon, authenticated
  using (active or privado.is_staff());

drop policy if exists forms_admin on public.forms;
create policy forms_admin on public.forms for all to authenticated
  using (privado.is_admin()) with check (privado.is_admin());

drop policy if exists fichas_enviar on public.submissions;
create policy fichas_enviar on public.submissions for insert to anon, authenticated
  with check (
    status = 'nova'
    and sessions = '[]'::jsonb
    and notes is null
    and exists (select 1 from public.forms f where f.id = form_id and f.active)
  );

drop policy if exists fichas_ler on public.submissions;
create policy fichas_ler on public.submissions for select to authenticated
  using (privado.is_staff());

drop policy if exists fichas_acompanhar on public.submissions;
create policy fichas_acompanhar on public.submissions for update to authenticated
  using (privado.is_staff()) with check (privado.is_staff());

drop policy if exists fichas_excluir on public.submissions;
create policy fichas_excluir on public.submissions for delete to authenticated
  using (privado.is_admin());

grant select on public.forms to anon, authenticated;
grant insert, update, delete on public.forms to authenticated;
grant insert on public.submissions to anon, authenticated;
grant select, update, delete on public.submissions to authenticated;
grant select, insert, update, delete on public.staff to authenticated;
grant execute on function privado.is_staff(), privado.is_admin() to anon, authenticated;

-- =========================================================================
-- Agenda
-- =========================================================================
-- Clientes (sem login) não leem a agenda: só veem quais horários estão
-- ocupados (sem nomes) e agendam pela função agendar(), que confere
-- expediente, serviço e conflito de horário.

-- Configuração única (expediente, serviços, WhatsApp) ---------------------
create table if not exists public.agenda_config (
  id         int primary key default 1 check (id = 1),
  config     jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.agenda_config (id, config) values (1, '{
  "fuso": "America/Sao_Paulo",
  "whatsapp": "",
  "mensagem": "Escolha o melhor dia e horário para o seu atendimento.",
  "intervalo": 30,
  "antecedencia_horas": 2,
  "dias_a_frente": 30,
  "horarios": {
    "0": [],
    "1": [["09:00", "12:00"], ["13:00", "18:00"]],
    "2": [["09:00", "12:00"], ["13:00", "18:00"]],
    "3": [["09:00", "12:00"], ["13:00", "18:00"]],
    "4": [["09:00", "12:00"], ["13:00", "18:00"]],
    "5": [["09:00", "12:00"], ["13:00", "18:00"]],
    "6": [["09:00", "13:00"]]
  },
  "servicos": [
    {"nome": "Avaliação", "duracao": 30},
    {"nome": "Regeneração dérmica (estrias)", "duracao": 90},
    {"nome": "Microderme", "duracao": 60}
  ]
}'::jsonb) on conflict (id) do nothing;

-- Agendamentos ------------------------------------------------------------
create table if not exists public.agendamentos (
  id               uuid primary key default gen_random_uuid(),
  inicio           timestamptz not null,
  fim              timestamptz not null check (fim > inicio),
  tipo             text not null default 'atendimento' check (tipo in ('atendimento', 'bloqueio')),
  servico          text not null check (char_length(servico) <= 120),
  cliente_nome     text not null check (char_length(cliente_nome) <= 200),
  cliente_telefone text check (char_length(cliente_telefone) <= 40),
  ficha_id         uuid references public.submissions (id) on delete set null,
  observacao       text check (char_length(observacao) <= 2000),
  origem           text not null default 'equipe' check (origem in ('cliente', 'equipe')),
  status           text not null default 'agendado'
                   check (status in ('agendado', 'confirmado', 'concluido', 'faltou', 'cancelado')),
  created_at       timestamptz not null default now(),
  -- dois horários ativos nunca se sobrepõem
  constraint agendamentos_sem_conflito
    exclude using gist (tstzrange(inicio, fim) with &&) where (status <> 'cancelado')
);

create index if not exists agendamentos_inicio_idx on public.agendamentos (inicio);
create index if not exists agendamentos_ficha_idx on public.agendamentos (ficha_id);

alter table public.agenda_config enable row level security;
alter table public.agendamentos  enable row level security;

drop policy if exists agenda_config_ler on public.agenda_config;
create policy agenda_config_ler on public.agenda_config for select to anon, authenticated using (true);

drop policy if exists agenda_config_admin on public.agenda_config;
create policy agenda_config_admin on public.agenda_config for update to authenticated
  using (privado.is_admin()) with check (privado.is_admin());

drop policy if exists agendamentos_equipe on public.agendamentos;
create policy agendamentos_equipe on public.agendamentos for all to authenticated
  using (privado.is_staff()) with check (privado.is_staff());

grant select on public.agenda_config to anon, authenticated;
grant update on public.agenda_config to authenticated;
grant select, insert, update, delete on public.agendamentos to authenticated;

-- Horários ocupados (sem dados das clientes), para a página de agendamento
create or replace function public.horarios_ocupados(p_de timestamptz, p_ate timestamptz)
returns table (inicio timestamptz, fim timestamptz)
language sql stable security definer set search_path = public as $$
  select a.inicio, a.fim
  from public.agendamentos a
  where a.status <> 'cancelado'
    and a.inicio < p_ate and a.fim > p_de
    and p_ate - p_de <= interval '62 days';
$$;

-- Agendamento feito pela cliente
create or replace function public.agendar(
  p_inicio timestamptz, p_servico text, p_nome text, p_telefone text, p_ficha uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c        jsonb;
  dur      int;
  v_local  timestamp;
  v_hora   time;
  dentro   boolean;
  novo     uuid;
  fone     text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
begin
  select config into c from public.agenda_config where id = 1;
  if c is null then raise exception 'A agenda ainda não foi configurada.'; end if;

  select (s ->> 'duracao')::int into dur
  from jsonb_array_elements(c -> 'servicos') s where s ->> 'nome' = p_servico limit 1;
  if dur is null then raise exception 'Serviço inválido.'; end if;

  if coalesce(trim(p_nome), '') = '' or length(fone) < 10 then
    raise exception 'Informe seu nome e telefone com DDD.';
  end if;

  if p_inicio < now() + make_interval(hours => coalesce((c ->> 'antecedencia_horas')::int, 0))
     or p_inicio > now() + make_interval(days => coalesce((c ->> 'dias_a_frente')::int, 30) + 1) then
    raise exception 'Esse horário não está disponível para agendamento.';
  end if;

  v_local := p_inicio at time zone coalesce(c ->> 'fuso', 'America/Sao_Paulo');
  v_hora := v_local::time;
  select exists (
    select 1 from jsonb_array_elements(coalesce(c -> 'horarios' -> (extract(dow from v_local)::int::text), '[]'::jsonb)) iv
    where v_hora >= (iv ->> 0)::time
      and v_hora + make_interval(mins => dur) <= (iv ->> 1)::time
      and v_hora + make_interval(mins => dur) > v_hora
  ) into dentro;
  if not dentro then raise exception 'Esse horário está fora do expediente.'; end if;

  if (select count(*) from public.agendamentos
      where regexp_replace(coalesce(cliente_telefone, ''), '\D', '', 'g') = fone
        and inicio > now() and status <> 'cancelado') >= 2 then
    raise exception 'Você já tem horários marcados. Fale com a gente pelo WhatsApp para remarcar.';
  end if;

  insert into public.agendamentos (inicio, fim, servico, cliente_nome, cliente_telefone, ficha_id, origem)
  values (p_inicio, p_inicio + make_interval(mins => dur), p_servico, left(trim(p_nome), 200), left(p_telefone, 40),
          (select s.id from public.submissions s where s.id = p_ficha), 'cliente')
  returning id into novo;
  return novo;
exception
  when exclusion_violation then
    raise exception 'Esse horário acabou de ser reservado. Escolha outro, por favor.';
end;
$$;

grant execute on function public.horarios_ocupados(timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.agendar(timestamptz, text, text, text, uuid) to anon, authenticated;

-- Segunda camada de proteção: o Supabase concede por padrão acesso total às
-- tabelas novas para "anon" e "authenticated". Aqui fica só o necessário
-- (as regras de RLS acima continuam valendo por cima disso).
revoke all on public.staff, public.forms, public.submissions, public.agenda_config, public.agendamentos from anon;
grant select on public.forms, public.agenda_config to anon;
grant insert on public.submissions to anon;
revoke truncate, references, trigger on public.staff, public.forms, public.submissions, public.agenda_config, public.agendamentos from authenticated;
revoke insert, delete on public.agenda_config from authenticated;
revoke execute on function public.horarios_ocupados(timestamptz, timestamptz), public.agendar(timestamptz, text, text, text, uuid) from public;
grant execute on function public.horarios_ocupados(timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.agendar(timestamptz, text, text, text, uuid) to anon, authenticated;
