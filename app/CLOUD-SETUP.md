# Sync data across devices (Supabase)

To access the same billing data from any device (phone, tablet, another computer), use **Supabase** as the cloud database.

## Steps

1. **Create a free Supabase project**
   - Go to [supabase.com](https://supabase.com) and sign up.
   - Create a new project (e.g. "billing-app"). Note the database password you set.

2. **Run the schema**
   - In your project, open **SQL Editor** → **New query**.
   - Copy the contents of `app/supabase-schema.sql` and paste into the editor.
   - Click **Run**. This creates the tables and Row Level Security so each user only sees their own data.

3. **Get your project URL and anon key**
   - In Supabase: **Settings** → **API**.
   - Copy **Project URL** and **anon public** key.

4. **Configure the app**
   - Open `app/js/config.js`.
   - Set `supabaseUrl` and `supabaseAnonKey` to the values you copied.

5. **Use the app**
   - Open the app and click **Sign in to sync across devices** in the sidebar.
   - **Sign up** with your email and a password (min 6 characters).
   - After signing in, all data is stored in Supabase and will be the same on any device where you sign in with the same account.

**Optional:** In Supabase **Authentication** → **Providers** you can disable "Confirm email" so sign-up works without email verification (useful for testing).
