# Fichas de Anamnese e Agenda · Regenera Skin

App para as clientes preencherem a ficha de anamnese pelo celular e já agendarem o horário.

| Página | Para quem | O que faz |
|---|---|---|
| `index.html?f=anamnese` | Clientes (link aberto, sem login) | Preenche e assina a ficha; no final, pode agendar o horário |
| `agendamento.html` | Clientes (link aberto, sem login) | Link só de agendamento: escolhe atendimento, dia e horário livre |
| `agenda.html` | Equipe (com login) | Agenda do dia e da semana, confirmação pelo WhatsApp, bloqueio de horários, expediente e serviços |
| `profissional.html` | Equipe (com login) | Fichas que chegaram, pontos de atenção, sessões, observações, impressão |
| `editor.html` | Administradoras (com login) | Cria e edita os questionários, gera o link para enviar no WhatsApp |

O caminho da cliente: **ficha → "Quer agendar seu horário agora?" → escolhe o horário → aparece na agenda**, já ligado à ficha dela (botão "Ver ficha de anamnese" no agendamento).

Detalhes que valem saber:

- **Pontos de atenção:** perguntas Sim/Não marcadas com "⚠ Destacar se SIM" (gravidez, alergia, Roacutan…) aparecem em vermelho no topo da ficha, para a profissional não deixar passar nada.
- **Editar não estraga fichas antigas:** cada ficha enviada guarda uma cópia das perguntas do momento em que foi preenchida.
- **Vários questionários:** dá para ter um por procedimento (ex.: `?f=microderme`, `?f=estrias`), cada um com o próprio link.
- **Assinatura com o dedo**, máscara de CPF/telefone e validação de CPF.
- **Agenda sem conflito:** o próprio banco de dados impede dois horários sobrepostos, mesmo que duas clientes cliquem ao mesmo tempo. A cliente só vê os horários livres, nunca o nome de outras clientes.
- **Expediente e serviços** (com intervalo de almoço, antecedência mínima e quantos dias a agenda fica aberta) são configurados em **Agenda → Horários e serviços**. Cada cliente pode ter no máximo 2 horários futuros pelo link; mais que isso, ela é orientada a chamar no WhatsApp.
- A agenda segue sempre o horário de Brasília, mesmo se a cliente abrir o link de outro fuso.

## Onde está no ar

- **Site:** https://regeneraskin.github.io/ (GitHub Pages, branch `main`). Agenda da equipe: https://regeneraskin.github.io/agenda.html
- **Banco de dados:** projeto Supabase `regenera` (região São Paulo), já criado e configurado. O `js/config.js` já aponta para ele.
- Para mudanças futuras no banco, o `supabase/schema.sql` reflete exatamente o que está no ar.

## Testar agora (modo demonstração)

Com `js/config.js` vazio (sem URL e chave), o app funciona sozinho e guarda tudo **só no navegador** de quem está usando. Serve para ver e testar, mas as fichas das clientes **não chegam** até você nesse modo.

Para abrir no computador: `python3 -m http.server` na pasta do projeto e acessar `http://localhost:8000`.
(Abrir o arquivo com dois cliques não funciona: o navegador bloqueia os scripts.)

## Colocar para funcionar de verdade

### 1. Criar o banco de dados (Supabase, plano gratuito)

1. Crie uma conta em <https://supabase.com> e um novo projeto (região **South America (São Paulo)**).
2. No menu **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Authentication → Sign In / Providers**, **desligue** "Allow new users to sign up". Assim só entra quem você cadastrar.

### 2. Cadastrar você e a equipe

1. Em **Authentication → Users → Add user → Create new user**, crie o seu login (e-mail + senha). Marque "Auto Confirm User".
2. No **SQL Editor**, rode (trocando o e-mail e o nome):

```sql
insert into public.staff (user_id, nome, papel)
select id, 'Nome da administradora', 'admin' from auth.users where email = 'seu-email@exemplo.com';
```

Para cada profissional, crie o usuário do mesmo jeito e rode o mesmo comando com `'profissional'` no lugar de `'admin'`. Profissionais veem as fichas; só administradoras editam questionários e excluem fichas.

### 3. Ligar o app ao banco

Em **Project Settings → API**, copie a **Project URL** e a chave **anon public** para `js/config.js`:

```js
export const SUPABASE_URL = 'https://xxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...';
```

A chave "anon" pode ficar pública: quem protege os dados são as regras do `schema.sql` (clientes só conseguem **enviar** fichas; ler, só a equipe logada). **Nunca** coloque aqui a chave `service_role`.

### 4. Publicar o site

Qualquer hospedagem de site estático serve. Pelo GitHub Pages: **Settings → Pages → Deploy from a branch → main / (root)**. O endereço fica algo como `https://seu-usuario.github.io/nome-do-repositorio/`.

Depois:

1. Entre no `editor.html`, crie o primeiro questionário com **"+ Novo a partir do modelo"** e salve.
2. Entre na `agenda.html` → **Horários e serviços**: ajuste expediente, serviços e coloque seu WhatsApp.
3. Mande para as clientes o link da ficha (botão **"+ Enviar ficha para cliente"** em Fichas) ou o link só de agendamento (botão **"Link de agendamento"** na Agenda).

> Já rodou o `schema.sql` antes desta versão? Rode de novo: ele só cria o que falta e não apaga nada.

## "Esqueci minha senha"

A tela de login tem o link "Esqueci minha senha", que manda um e-mail com um link para `nova-senha.html`. Para funcionar, no Supabase:

1. **Authentication → URL Configuration:** Site URL `https://regeneraskin.github.io` e, em Redirect URLs, `https://regeneraskin.github.io/nova-senha.html`.
2. **E-mails:** sem um servidor de e-mail próprio (custom SMTP), o Supabase só entrega e-mails para pessoas que fazem parte da equipe da organização. Convide cada profissional em Organization → Team (papel "Read-only" basta).

## Cópia de segurança das fichas

Em **Fichas → ⬇ Baixar**: planilha (CSV para Excel) com todas as respostas, ou PDF completo com as assinaturas. Recomendado uma vez por mês.

## Publicando mudanças

Antes de publicar qualquer alteração nos arquivos `js/` ou `css/`, rode:

```
python3 scripts/versao.py
```

Isso carimba um número de versão nos arquivos. Sem ele, o navegador de quem já abriu o site pode misturar arquivos novos com antigos guardados e a página fica presa em "Carregando…".

## Cuidados com os dados (LGPD)

Ficha de anamnese tem **dados de saúde**, que a LGPD trata como dados sensíveis. O app já ajuda com isso: termo de consentimento específico para uso dos dados, acesso só com login, autorização de imagem separada (com opção "sem identificação"). Mesmo assim:

- Use senhas fortes e não compartilhe logins entre profissionais.
- Exclua fichas que não precisar mais guardar.
- Vale uma conversa com um(a) advogado(a) para revisar os textos do termo para os seus procedimentos.

## Estrutura

```
index.html, agendamento.html        ← páginas das clientes
agenda.html, profissional.html, editor.html  ← páginas da equipe
css/style.css
js/config.js          ← configuração do Supabase
js/api.js             ← acesso aos dados (Supabase ou demonstração)
js/render.js          ← desenha o questionário e as respostas
js/modelo-padrao.js   ← ficha inicial (base para "Novo a partir do modelo")
js/cliente.js, js/agendamento.js, js/agenda.js, js/profissional.js, js/editor.js, js/equipe.js
supabase/schema.sql   ← tabelas e regras de segurança
```
