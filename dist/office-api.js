(() => {
  'use strict';
  const A = window.EloAuth;
  const columns = 'id,name,responsible_user_id,responsible_name,responsible_email,phone,oab_number,oab_state,created_at,plan_code,plan_selected_at';
  const failure = code => Object.assign(new Error(code), { code });
  async function readFor(user) {
    const { data, error } = await A.client().from('offices').select(columns).eq('responsible_user_id', user.id).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function load() {
    const user = await A.user();
    return { user, office: await readFor(user) };
  }
  async function create(input, expectedUserId) {
    const user = await A.user();
    if (!expectedUserId || user.id !== expectedUserId) throw failure('account_changed');
    const existing = await readFor(user);
    if (existing) return { office: existing, alreadyExists: true };
    const payload = {
      name: input.name.trim(), responsible_user_id: user.id,
      responsible_name: input.responsibleName.trim(), responsible_email: input.email.trim(), phone: input.phone.trim() || null,
      oab_number: input.oabNumber.trim(), oab_state: input.oabState
    };
    const { data, error } = await A.client().from('offices').insert(payload).select(columns).single();
    if (!error && data) return { office: data, alreadyExists: false };
    // The unique responsible account also makes retries safe after a lost response.
    if (error?.code === '23505') {
      const office = await readFor(user);
      if (office) return { office, alreadyExists: true };
    }
    throw error || failure('save_unconfirmed');
  }
  async function savePlan(planCode, officeId, expectedUserId) {
    if (!['essencial', 'equipe', 'personalizado'].includes(planCode)) throw failure('invalid_plan');
    const user = await A.user();
    if (!expectedUserId || user.id !== expectedUserId) throw failure('account_changed');
    if (!officeId) throw failure('office_missing');
    const { data, error } = await A.client().from('offices')
      .update({ plan_code: planCode }).eq('id', officeId).eq('responsible_user_id', user.id)
      .select(columns).single();
    if (error) throw error;
    if (!data || data.id !== officeId || data.responsible_user_id !== user.id || data.plan_code !== planCode || !data.plan_selected_at) throw failure('save_unconfirmed');
    return data;
  }
  function planMessage(error) {
    if (error?.code === 'invalid_plan') return 'Selecione uma das opções de plano disponíveis.';
    if (error?.code === '42501' || error?.code === 'office_missing' || error?.code === 'PGRST116') return 'Não foi possível autorizar a escolha para este escritório. Reabra a página com a conta responsável.';
    return 'Não foi possível confirmar a escolha. Sua seleção continua nesta tela. Tente salvar novamente; isso não cria uma assinatura nem duplica o cadastro.';
  }
  function message(error) {
    if (error?.code === 'account_changed') return 'A conta conectada mudou. Entre novamente para conferir o responsável.';
    if (error?.code === '23514' || error?.code === '23502') return 'Confira os dados informados. Há um campo fora do formato aceito.';
    if (error?.code === '42501') return 'Não foi possível autorizar este cadastro. Verifique a conta conectada e tente novamente.';
    if (error?.code === 'PGRST205' || error?.code === '42P01') return 'O cadastro está temporariamente indisponível. Tente novamente em instantes.';
    if (['session_missing', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt'].includes(error?.code) || error?.name === 'AuthSessionMissingError' || error?.status === 401) return 'Sua sessão terminou. Entre novamente para continuar o cadastro.';
    return 'Não foi possível confirmar o cadastro. Seus dados continuam nesta tela. Tente novamente; um cadastro já salvo será recuperado sem duplicação.';
  }
  window.EloOffice = { load, create, savePlan, message, planMessage };
})();
