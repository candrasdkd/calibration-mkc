import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function defaultKey(name: string) {
  const keyMap = Deno.env.get(name);
  if (!keyMap) return '';
  try {
    return JSON.parse(keyMap).default ?? '';
  } catch {
    return '';
  }
}

function validRedirect(value: string) {
  try {
    const url = new URL(value);
    const expoPath = /(?:\/--)?\/auth\/callback\/?$/.test(url.pathname);
    const standalonePath = (url.hostname === 'auth' && url.pathname === '/callback')
      || (!url.hostname && url.pathname === '/auth/callback');
    return (['exp:', 'exps:'].includes(url.protocol) && expoPath)
      || (url.protocol === 'kalibrasimobile:' && standalonePath);
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method tidak didukung.' }, 405);

  const authorization = request.headers.get('Authorization');
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || defaultKey('SUPABASE_PUBLISHABLE_KEYS');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || defaultKey('SUPABASE_SECRET_KEYS');
  if (!authorization || !url || !anonKey || !serviceKey) return response({ error: 'Konfigurasi server belum lengkap.' }, 500);

  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
  if (authError || !caller) return response({ error: 'Sesi admin tidak valid. Silakan login ulang.' }, 401);

  const { data: profile, error: profileError } = await adminClient.from('profiles').select('role').eq('id', caller.id).maybeSingle();
  if (profileError) return response({ error: 'Role admin tidak bisa diverifikasi.' }, 500);
  if (profile?.role !== 'admin') return response({ error: 'Hanya admin yang dapat mengelola akun teknisi.' }, 403);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return response({ error: 'Isi permintaan tidak valid.' }, 400);
  }

  if (body.action === 'invite') {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const clientId = typeof body.clientId === 'string' ? body.clientId : '';
    const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : '';
    const manualOnly = body.manualOnly === true;
    if (!name || name.length > 120 || !phone || phone.length > 40 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return response({ error: 'Nama, email, atau nomor telepon teknisi tidak valid.' }, 400);
    }
    if (!manualOnly && !validRedirect(redirectTo)) return response({ error: 'Tautan aktivasi aplikasi tidak valid.' }, 400);

    let duplicateQuery = adminClient.from('technicians').select('client_id').ilike('email', email);
    if (clientId) duplicateQuery = duplicateQuery.neq('client_id', clientId);
    const { data: existing, error: existingError } = await duplicateQuery.maybeSingle();
    if (existingError) return response({ error: 'Data teknisi belum bisa diperiksa.' }, 500);
    if (existing) return response({ error: 'Email ini sudah terdaftar sebagai teknisi.' }, 409);

    let linkTarget: { id: string; user_id: string | null } | null = null;
    if (clientId) {
      const { data: target, error: targetError } = await adminClient.from('technicians')
        .select('id,user_id').eq('client_id', clientId).maybeSingle();
      if (targetError) return response({ error: 'Data teknisi yang akan ditautkan tidak bisa dibaca.' }, 500);
      if (target?.user_id) return response({ error: 'Teknisi ini sudah memiliki akun tertaut.' }, 409);
      linkTarget = target;
    }

    const { data: users, error: usersError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) return response({ error: 'Akun email belum bisa diperiksa.' }, 500);
    const existingUser = users.users.find((user) => user.email?.toLowerCase() === email);
    let existingProfile: { role: string; full_name: string; phone: string } | null = null;
    let userId = existingUser?.id ?? '';
    let invitationSent = false;
    let accountStatus = existingUser?.email_confirmed_at ? 'active' : 'invited';
    if (existingUser) {
      const { data: previousProfile, error: existingProfileError } = await adminClient.from('profiles')
        .select('role,full_name,phone').eq('id', existingUser.id).maybeSingle();
      if (existingProfileError) return response({ error: 'Role akun email tidak bisa diperiksa.' }, 500);
      if (previousProfile?.role === 'admin') return response({ error: 'Email ini sudah digunakan akun admin.' }, 409);
      existingProfile = previousProfile;
    } else {
      if (manualOnly) return response({ error: 'Akun belum dibuat. Buat user dan password di Supabase Authentication > Users, lalu tautkan dengan email yang sama.' }, 404);
      const { data: invitation, error: invitationError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name: name, phone },
        redirectTo,
      });
      if (invitationError || !invitation.user) {
        return response({ error: invitationError?.message ?? 'Undangan email gagal dikirim.' }, invitationError?.status === 422 ? 409 : 400);
      }
      userId = invitation.user.id;
      invitationSent = true;
      accountStatus = 'invited';
    }

    const { error: profileUpdateError } = await adminClient.from('profiles').upsert({
      id: userId, full_name: name, phone, role: 'technician',
    }, { onConflict: 'id' });
    if (profileUpdateError) {
      if (invitationSent) await adminClient.auth.admin.deleteUser(userId);
      return response({ error: 'Profil teknisi gagal dibuat.' }, 500);
    }

    const technicianWrite = linkTarget
      ? adminClient.from('technicians').update({ user_id: userId, name, email, phone, account_status: accountStatus, created_by: caller.id }).eq('id', linkTarget.id)
      : adminClient.from('technicians').insert({
        client_id: clientId || userId, user_id: userId, name, email, phone, account_status: accountStatus, created_by: caller.id,
      });
    const { data: technician, error: technicianError } = await technicianWrite
      .select('client_id,user_id,name,email,phone,account_status').single();
    if (technicianError || !technician) {
      if (invitationSent) await adminClient.auth.admin.deleteUser(userId);
      else if (existingProfile) await adminClient.from('profiles').update(existingProfile).eq('id', userId);
      else await adminClient.from('profiles').delete().eq('id', userId);
      return response({ error: 'Data teknisi gagal disimpan. Coba kirim undangan lagi.' }, 500);
    }

    return response({ technician: {
      id: technician.client_id,
      userId: technician.user_id,
      name: technician.name,
      email: technician.email,
      phone: technician.phone,
      accountStatus: technician.account_status,
    }, invitationSent });
  }

  if (body.action === 'set-status') {
    const id = typeof body.id === 'string' ? body.id : '';
    const status = body.status === 'active' || body.status === 'disabled' ? body.status : null;
    if (!id || !status) return response({ error: 'Status akun teknisi tidak valid.' }, 400);

    const { data: technician, error: technicianError } = await adminClient.from('technicians')
      .select('id,user_id,account_status,email').eq('client_id', id).maybeSingle();
    if (technicianError) return response({ error: 'Data teknisi tidak bisa dibaca.' }, 500);
    if (!technician?.user_id) return response({ error: 'Teknisi ini belum memiliki akun tertaut.' }, 404);
    if (status === 'active') {
      const { data: authUser, error: authUserError } = await adminClient.auth.admin.getUserById(technician.user_id);
      if (authUserError) return response({ error: 'Akun teknisi tidak bisa diperiksa.' }, 500);
      if (!authUser.user?.email_confirmed_at) return response({ error: 'Teknisi harus menerima undangan email sebelum akunnya diaktifkan.' }, 409);
    }

    const { error: updateError } = await adminClient.from('technicians').update({ account_status: status }).eq('id', technician.id);
    if (updateError) return response({ error: 'Status akun teknisi gagal diperbarui.' }, 500);
    return response({ id, accountStatus: status });
  }

  if (body.action === 'set-password') {
    const id = typeof body.id === 'string' ? body.id : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!id || password.length < 8 || password.length > 72) {
      return response({ error: 'Kata sandi harus berisi 8–72 karakter.' }, 400);
    }
    const { data: technician, error: technicianError } = await adminClient.from('technicians')
      .select('user_id,account_status').eq('client_id', id).maybeSingle();
    if (technicianError) return response({ error: 'Data teknisi tidak bisa dibaca.' }, 500);
    if (!technician?.user_id) return response({ error: 'Teknisi ini belum memiliki akun tertaut.' }, 404);
    if (technician.account_status === 'disabled') return response({ error: 'Aktifkan akun teknisi sebelum mengatur kata sandi.' }, 409);
    const { data: profile, error: profileError } = await adminClient.from('profiles')
      .select('role').eq('id', technician.user_id).maybeSingle();
    if (profileError) return response({ error: 'Role akun teknisi tidak bisa diverifikasi.' }, 500);
    if (profile?.role !== 'technician') return response({ error: 'Akun tertaut bukan akun teknisi.' }, 409);
    const { error: passwordError } = await adminClient.auth.admin.updateUserById(technician.user_id, {
      password,
      email_confirm: true,
    });
    if (passwordError) return response({ error: passwordError.message }, passwordError.status ?? 400);
    const { error: statusError } = await adminClient.from('technicians')
      .update({ account_status: 'active' }).eq('client_id', id);
    if (statusError) return response({ error: 'Kata sandi sudah diatur, tetapi status teknisi gagal diaktifkan.' }, 500);
    return response({ id, accountStatus: 'active' });
  }

  if (body.action === 'resend') {
    const id = typeof body.id === 'string' ? body.id : '';
    const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : '';
    if (!id || !validRedirect(redirectTo)) return response({ error: 'Data undangan tidak valid.' }, 400);
    const { data: technician, error: technicianError } = await adminClient.from('technicians')
      .select('email,name,phone,user_id,account_status').eq('client_id', id).maybeSingle();
    if (technicianError) return response({ error: 'Data teknisi tidak bisa dibaca.' }, 500);
    if (!technician?.email) return response({ error: 'Email akun teknisi tidak ditemukan.' }, 409);
    if (!technician.user_id) return response({ error: 'Akun teknisi belum tertaut.' }, 409);
    const { data: authResult, error: authUserError } = await adminClient.auth.admin.getUserById(technician.user_id);
    if (authUserError) return response({ error: 'Status akun teknisi tidak bisa diperiksa.' }, 500);
    if (authResult.user.email_confirmed_at) {
      if (technician.account_status !== 'active') {
        const { error: statusError } = await adminClient.from('technicians')
          .update({ account_status: 'active' }).eq('client_id', id);
        if (statusError) return response({ error: 'Status akun teknisi gagal diperbarui.' }, 500);
      }
      const { error: resetError } = await adminClient.auth.resetPasswordForEmail(technician.email, { redirectTo });
      if (resetError) return response({ error: resetError.message }, 400);
      return response({ id, linkType: 'password-reset' });
    }
    if (technician.account_status === 'invited') {
      const { error: invitationError } = await adminClient.auth.admin.inviteUserByEmail(technician.email, {
        data: { full_name: technician.name, phone: technician.phone }, redirectTo,
      });
      if (invitationError) return response({ error: invitationError.message }, invitationError.status === 422 ? 409 : 400);
      return response({ id, linkType: 'invitation' });
    }
    return response({ error: 'Akun teknisi belum aktif.' }, 409);
  }

  return response({ error: 'Aksi tidak dikenal.' }, 400);
});
