(() => {
  'use strict';
  const config = window.EloAuthConfig;
  const safeRoute = route => /^#(?:inicio|casos|revisoes|equipe|convite\/[a-f0-9]{64}|trabalho\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|cadastro-escritorio|planos|contratacao|caso\/ELO-\d+(?:\/(?:context|history))?)$/.test(route || '') ? route : '#inicio';
  const destination = route => ({ '#cadastro-escritorio':'cadastro-escritorio.html', '#planos':'planos.html', '#contratacao':'contratacao.html' }[safeRoute(route)] || 'index.html' + safeRoute(route));
  const nextRoute = () => safeRoute(new URLSearchParams(location.search).get('next'));
  const fail = code => Object.assign(new Error(code), { code });
  let instance, principal, recovery;
  function client() {
    if (instance) return instance;
    if (!config?.url?.startsWith('https://') || !config.publishableKey?.startsWith('sb_publishable_') || !window.supabase) throw fail('configuration');
    instance = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { storageKey: config.storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' }
    });
    instance.auth.onAuthStateChange((event, session) => {
      // Do not call Auth methods inside this callback: the SDK holds its session lock.
      if (event === 'SIGNED_OUT') { principal = null; recovery = null; }
      setTimeout(() => window.dispatchEvent(new CustomEvent('elo-auth-change', { detail: { event, userId: session?.user?.id || null } })), 0);
    });
    return instance;
  }
  function redirectUrl(page, next) {
    const url = new URL(page, location.href);
    url.search = ''; url.hash = '';
    url.searchParams.set('next', safeRoute(next));
    return url.href;
  }
  async function user() {
    const { data, error } = await client().auth.getUser();
    if (error) throw error;
    if (!data.user?.id || data.user.is_anonymous || !data.user.email_confirmed_at) throw fail('session_missing');
    principal = data.user;
    return principal;
  }
  async function login(email, password) {
    const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    return user();
  }
  async function register(name, email, password, next) {
    const { data, error } = await client().auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: redirectUrl('login.html', next) }
    });
    if (error) throw error;
    if (data.session) await logout();
    return { confirmationRequired: !data.session };
  }
  async function requestRecovery(email, next) {
    const { error } = await client().auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl('redefinir-senha.html', next) });
    if (error) throw error;
  }
  function hasCallback() {
    const query = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.slice(1));
    return query.has('code') || query.has('error') || hash.has('error');
  }
  async function consumeCode(expected) {
    const query = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.slice(1));
    const code = query.get('code'), flowId = query.get('sb_flow_id');
    const callbackError = query.has('error') || hash.has('error');
    // Remove one-time credentials and provider error details from the address bar.
    history.replaceState(null, '', location.pathname + '?next=' + encodeURIComponent(nextRoute()));
    recovery = null;
    if (!code || callbackError) throw fail('invalid_link');
    const { data, error } = await client().auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error || !data.session) throw fail('invalid_link');
    if ((expected === 'recovery') !== (data.redirectType === 'recovery')) {
      await logout(); throw fail('invalid_link');
    }
    const verified = await user();
    if (expected === 'recovery') recovery = { userId: verified.id, expires: Date.now() + 15 * 60 * 1000 };
    return verified;
  }
  async function resetPassword(password) {
    if (!recovery || recovery.expires < Date.now()) throw fail('invalid_link');
    const verified = await user();
    if (verified.id !== recovery.userId) throw fail('invalid_link');
    const { error } = await client().auth.updateUser({ password });
    if (error) throw error;
    recovery = null;
    const { error: signOutError } = await client().auth.signOut({ scope: 'global' });
    if (signOutError) {
      await client().auth.signOut({ scope: 'local' });
      try { localStorage.removeItem(config.storageKey); } catch {}
    }
    principal = null;
    return { sessionsRevoked: !signOutError };
  }
  async function logout() {
    const { error } = await client().auth.signOut({ scope: 'local' });
    if (error) throw error;
    principal = null; recovery = null;
  }
  async function requireUser() {
    try { return await user(); }
    catch {
      location.replace('login.html?reason=session&next=' + encodeURIComponent(safeRoute(location.hash)));
      return null;
    }
  }
  function storageKey(base) {
    if (!principal) throw fail('session_missing');
    return base + ':' + principal.id;
  }
  function displayName() { return String(principal?.user_metadata?.full_name || principal?.email || 'Minha conta').slice(0, 120); }
  function message(error) {
    const messages = {
      invalid_credentials: 'E-mail ou senha não conferem.',
      email_not_confirmed: 'Confirme seu e-mail pelo link recebido antes de entrar.',
      user_already_exists: 'Não foi possível concluir o cadastro. Se você já tem uma conta, entre ou recupere sua senha.',
      weak_password: 'Escolha uma senha mais forte, com pelo menos 8 caracteres.',
      same_password: 'Escolha uma senha diferente da sua senha atual.',
      over_email_send_rate_limit: 'O limite de envio de e-mails foi atingido. Aguarde antes de tentar novamente.',
      over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      email_address_not_authorized: 'O envio de e-mails ainda está em configuração. Por enquanto, somente membros da organização podem receber links.',
      email_address_invalid: 'Confira o formato do e-mail.',
      signup_disabled: 'O cadastro está temporariamente indisponível.',
      invalid_link: 'Este link é inválido, expirou ou já foi utilizado. Solicite outro e abra no mesmo navegador em que iniciou o pedido.',
      session_missing: 'Sua sessão terminou. Entre novamente.',
      configuration: 'O serviço de acesso ainda não está configurado.'
    };
    if (messages[error?.code]) return messages[error.code];
    if (error?.status === 429) return messages.over_request_rate_limit;
    if (error?.name === 'AuthRetryableFetchError' || error instanceof TypeError) return 'Não foi possível conectar ao serviço de acesso. Confira sua conexão e tente novamente.';
    return 'Não foi possível concluir a solicitação. Tente novamente em alguns instantes.';
  }
  window.EloAuth = { safeRoute, destination, nextRoute, client, login, register, requestRecovery, hasCallback, consumeCode, resetPassword, logout, requireUser, user, storageKey, displayName, message };
})();
