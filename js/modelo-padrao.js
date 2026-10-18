// Ficha inicial, montada a partir das fichas de exemplo (anamnese para
// regeneração dérmica / microderme). Tudo aqui pode ser alterado no editor.
export function modeloPadrao() {
  const sn = (id, label, extra = {}) => ({ id, type: 'yesno', label, required: true, ...extra });
  return {
    title: 'Ficha de Anamnese',
    subtitle: 'Regeneração dérmica',
    intro: 'Olá! Antes do seu procedimento, preencha esta ficha com atenção. ' +
      'Suas respostas ajudam a profissional a cuidar de você com segurança e ficam guardadas com sigilo.',
    oferecer_agendamento: true,
    sections: [
      {
        id: 's_dados', title: 'Dados pessoais', fields: [
          { id: 'nome', type: 'short', format: 'nome', label: 'Nome completo', required: true },
          { id: 'telefone', type: 'short', format: 'telefone', label: 'Telefone (WhatsApp)', required: true },
          { id: 'nascimento', type: 'date', label: 'Data de nascimento', required: true },
          { id: 'cpf', type: 'short', format: 'cpf', label: 'CPF', required: false },
          { id: 'endereco', type: 'short', format: 'texto', label: 'Endereço', required: false },
        ],
      },
      {
        id: 's_queixa', title: 'Queixa principal', fields: [
          { id: 'queixa', type: 'long', label: 'O que você deseja tratar?', required: true,
            help: 'Ex.: estrias brancas no quadril, cicatriz de acne no rosto…' },
          { id: 'areas', type: 'multi', label: 'Qual área você deseja tratar?', required: true, options: [
            'Rosto', 'Seios', 'Braços', 'Ombros', 'Abdômen', 'Flancos', 'Lombar', 'Glúteos',
            'Lateral das coxas', 'Interno das coxas', 'Posterior das coxas', 'Joelhos', 'Panturrilhas', 'Outra',
          ] },
          sn('tratamento_anterior', 'Já fez algum tratamento anterior nessa região?', { detail: true, detailLabel: 'Qual e quando?' }),
          sn('hiperpigmentacao', 'Costuma ter manchas escuras na pele (hiperpigmentação)?'),
        ],
      },
      {
        id: 's_saude', title: 'Histórico de saúde', fields: [
          sn('alergia', 'Tem alergia a algum medicamento ou produto?', { detail: true, detailLabel: 'Qual?', alert: true }),
          sn('medicamento', 'Está usando algum medicamento?', { detail: true, detailLabel: 'Qual?' }),
          sn('aspirina', 'Usou aspirina ou anticoagulante nos últimos 5 dias?', { alert: true }),
          sn('roacutan', 'Usou Roacutan (isotretinoína) nos últimos 6 meses?', { alert: true }),
          sn('acidos', 'Está usando algum ácido ou hidroquinona na pele?', { detail: true, detailLabel: 'Qual e desde quando?', alert: true }),
          sn('injetado', 'Fez algum procedimento ou injetou algum produto na região nos últimos meses?', { detail: true, detailLabel: 'Qual e quando?', alert: true }),
          sn('gravida', 'Está grávida ou amamentando?', { alert: true }),
          sn('cardiopata', 'Tem algum problema no coração?', { detail: true, detailLabel: 'Qual?', alert: true }),
          sn('hipertensao', 'Tem pressão alta (hipertensão)?', { alert: true }),
          sn('diabetes', 'Tem diabetes?', { alert: true }),
          sn('anemia', 'Tem anemia?', { alert: true }),
          sn('hemofilia', 'Tem hemofilia ou algum problema de coagulação?', { alert: true }),
          sn('cancer', 'Tem ou já teve câncer?', { detail: true, detailLabel: 'Qual e quando?', alert: true }),
          sn('queloide', 'Tem queloide ou dificuldade de cicatrização?', { alert: true }),
          sn('infecto', 'Tem alguma doença infectocontagiosa?', { detail: true, detailLabel: 'Qual?', alert: true }),
          sn('ansiedade', 'Tem depressão ou ansiedade?', { detail: true, detailLabel: 'Faz algum tratamento?' }),
          sn('tatuagem', 'Tem tatuagem na região a ser tratada?'),
          { id: 'outro', type: 'long', label: 'Há algum outro problema de saúde que queira mencionar?', required: false },
        ],
      },
      {
        id: 's_cuidados', title: 'Cuidados importantes', fields: [
          { id: 'aviso', type: 'info', label:
            'Durante a cicatrização (pelo menos 30 dias), não exponha a área tratada ao sol e não faça ' +
            '"banho de lua" (descoloração dos pelos) na região. A profissional vai te passar todas as orientações pós-procedimento.' },
        ],
      },
      {
        id: 's_termo', title: 'Termo de consentimento', fields: [
          { id: 'declaracao', type: 'consent', required: true, label:
            'Declaro que as informações acima são verdadeiras e que não omiti nada sobre a minha saúde. ' +
            'O procedimento, seus riscos, possíveis reações e os cuidados necessários me foram explicados, ' +
            'tive a oportunidade de tirar minhas dúvidas e me comprometo a seguir as orientações pós-procedimento.' },
          { id: 'lgpd', type: 'consent', required: true, label:
            'Autorizo o uso dos meus dados pessoais e de saúde informados nesta ficha exclusivamente para a avaliação ' +
            'e o acompanhamento do meu tratamento, conforme a Lei Geral de Proteção de Dados (LGPD).' },
          { id: 'imagem', type: 'choice', required: true, label: 'Uso de fotos do procedimento (antes e depois) para divulgação:',
            options: ['Autorizo', 'Autorizo, sem mostrar meu rosto ou o que me identifique', 'Não autorizo'] },
          { id: 'assinatura', type: 'signature', label: 'Assinatura', required: true,
            help: 'Assine com o dedo (no celular) ou com o mouse.' },
        ],
      },
    ],
  };
}

// Mensagens de WhatsApp. Palavras entre chaves são trocadas pelo app:
// {nome}, {servico}, {data}, {hora}, {link}.
export const MENSAGENS_PADRAO = {
  ficha:
    'Olá, {nome}! Tudo bem? 🌸\n\n' +
    'É um prazer ter você na Regenera Skin! ✨\n\n' +
    'Antes do seu atendimento, peço que preencha a ficha de anamnese. Com essas informações, ' +
    'conheço melhor a sua pele e a sua saúde e conduzo o seu tratamento com toda a segurança que você merece. 💕\n\n' +
    'O preenchimento leva cerca de 5 minutos:\n{link}\n\n' +
    'Se tiver qualquer dúvida, estou à disposição.',
  agendamento:
    'Olá, {nome}! Tudo bem? 🌸\n\n' +
    'Fico muito feliz em saber que você quer viver esse momento de cuidado com a gente! ✨\n\n' +
    'Pelo link abaixo, você escolhe o dia e o horário mais convenientes:\n{link}\n\n' +
    'Assim que concluir, o seu horário fica reservado. Será um prazer atender você! 💕',
  confirmacao:
    'Olá, {nome}! Tudo bem? 🌸\n\n' +
    'Passando para confirmar o seu atendimento:\n\n' +
    '✨ {servico}\n📅 {data}\n⏰ {hora}\n\n' +
    'Posso confirmar a sua presença? Caso precise remarcar, é só me avisar por aqui. 💕\n\n' +
    'Com carinho, Regenera Skin',
  aviso_cliente:
    'Olá! Aqui é {nome}. 🌸\n\n' +
    'Acabei de agendar pelo link:\n\n' +
    '✨ {servico}\n📅 {data}\n⏰ {hora}\n\n' +
    'Até breve!',
};

export function mensagens(config) {
  return { ...MENSAGENS_PADRAO, ...(config?.mensagens || {}) };
}

// Expediente e serviços iniciais da agenda (iguais ao supabase/schema.sql).
// Dias da semana: 0 = domingo … 6 = sábado.
export function agendaPadrao() {
  const comercial = [['09:00', '12:00'], ['13:00', '18:00']];
  return {
    fuso: 'America/Sao_Paulo',
    whatsapp: '',
    mensagem: 'Escolha o melhor dia e horário para o seu atendimento.',
    intervalo: 30,
    antecedencia_horas: 2,
    dias_a_frente: 30,
    horarios: { 0: [], 1: comercial, 2: comercial, 3: comercial, 4: comercial, 5: comercial, 6: [['09:00', '13:00']] },
    servicos: [
      { nome: 'Avaliação', duracao: 30 },
      { nome: 'Regeneração dérmica (estrias)', duracao: 90 },
      { nome: 'Microderme', duracao: 60 },
    ],
    mensagens: { ...MENSAGENS_PADRAO },
  };
}
