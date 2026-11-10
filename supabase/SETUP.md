# Menyiapkan Supabase

1. Buat project Supabase, lalu salin Project URL dan publishable key ke `.env` berdasarkan `.env.example`.
2. Login, hubungkan CLI, dan terapkan migrasi:

   ```sh
   npx supabase login
   npx supabase link --project-ref PROJECT_REF
   npx supabase db push
   ```

3. Buat akun admin pertama lewat **Authentication → Users**. Di SQL Editor, jadikan akun itu admin:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'admin@contoh.id');
   ```

4. Atur **Authentication → URL Configuration → Redirect URLs** dan izinkan:

   ```text
   kalibrasimobile://auth/callback
   exp://**/--/auth/callback
   exps://**/--/auth/callback
   ```

   URL `exp` / `exps` dipakai Expo Go saat pengembangan. Build aplikasi memakai scheme `kalibrasimobile`.

5. Konfigurasikan SMTP dan template **Invite user** di **Authentication → Email** supaya Supabase dapat mengirim undangan ke teknisi.
6. Deploy Edge Function pengelola akun teknisi:

   ```sh
   npx supabase functions deploy manage-technician
   ```

   Function memakai secret Supabase yang tersedia di server. Jangan salin secret key atau `service_role` ke `.env` Expo.
7. Jalankan ulang Expo (`npx expo start -c`) dan login menggunakan akun admin. Dari **Data teknisi**, admin bisa mengundang akun lewat email. Teknisi membuka tautan, membuat kata sandi, lalu login.

Skema menautkan akun undangan ke data teknisi, hanya mengizinkan akun teknisi aktif mengakses data kalibrasi, dan menyimpan riwayat walau akun dinonaktifkan. Supabase perlu mengizinkan redirect URL dan mengirim email sebelum undangan dapat digunakan.
