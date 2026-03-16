# Complete Supabase setup guide (step by step)

Follow these steps to enable **“same data on any device”** for your billing app.

---

## Step 1: Create a Supabase account

1. Open your browser and go to **https://supabase.com**
2. Click **Start your project**
3. Sign up with **GitHub**, **Google**, or **Email**
4. Complete sign-up (verify email if you used email)

---

## Step 2: Create a new project

1. After logging in, click **New Project**
2. Choose your **Organization** (or create one if asked)
3. Fill in:
   - **Name:** e.g. `billing-app` (any name is fine)
   - **Database Password:** create a **strong password** and **save it somewhere safe** (you need it for direct DB access; the app does not use it)
   - **Region:** pick the closest to you (e.g. Southeast Asia (Mumbai) for India)
4. Click **Create new project**
5. Wait 1–2 minutes until the project is ready (you’ll see the dashboard)

---

## Step 3: Run the database schema (create tables)

1. In the left sidebar, click **SQL Editor**
2. Click **+ New query**
3. Open the file **`app/supabase-schema.sql`** from your Billing project in a text editor
4. Select all the SQL (Ctrl+A), copy it (Ctrl+C)
5. Paste it into the Supabase SQL Editor (the big text area)
6. Click **Run** (or press Ctrl+Enter)
7. You should see a green success message like “Success. No rows returned”
8. Tables are now created: `businesses`, `user_preferences`, `customers`, `products`, `invoices`

---

## Step 4: Get your Project URL and anon key

1. In the left sidebar, click **Settings** (gear icon at the bottom)
2. Click **API** under “Project settings”
3. On the API page you’ll see:
   - **Project URL** — e.g. `https://abcdefghijk.supabase.co`
   - **Project API keys** — two keys:
     - **anon** / **public** — this is the one you need (safe to use in the browser)
     - **service_role** — do **not** use this in your app (keep it secret)
4. Click the **Copy** button next to **Project URL** and save it somewhere (e.g. Notepad)
5. Click the **Copy** button next to the **anon public** key and save it too

---

## Step 5: Put the URL and key into your app

1. Open your Billing app folder in your editor
2. Open the file **`app/js/config.js`**
3. Replace the two values with your own:

```javascript
window.BillingConfig = {
  supabaseUrl: 'https://YOUR-PROJECT-ID.supabase.co',   // paste Project URL here
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',   // paste anon public key here
};
```

4. Save the file

- Use your **real** Project URL and anon key from Step 4.
- Keep the quotes and commas as in the example.

---

## Step 6: (Optional) Turn off email confirmation for testing

If you want to sign up and use the app immediately without checking email:

1. In Supabase left sidebar: **Authentication** → **Providers**
2. Click **Email**
3. Find **“Confirm email”**
4. Turn it **OFF**
5. Click **Save**

(You can turn it back on later for production.)

---

## Step 7: Use the app with cloud sync

1. Open your billing app in the browser (e.g. open `app/index.html` or run a local server)
2. In the **sidebar** (left), you should see **“Sign in to sync across devices”**
3. Click it
4. In the popup:
   - **Sign up:** enter your email and a password (at least 6 characters) → click **Sign up**
   - Or **Sign in** if you already have an account
5. After signing in, your data is stored in Supabase
6. On **another device or browser**, open the same app, sign in with the **same email and password** — you’ll see the same data

---

## Checklist

- [ ] Supabase account created  
- [ ] New project created (name + database password saved)  
- [ ] `app/supabase-schema.sql` run in SQL Editor (success message)  
- [ ] Project URL and anon key copied from Settings → API  
- [ ] `app/js/config.js` updated with your URL and anon key  
- [ ] (Optional) Email confirmation disabled under Authentication → Providers  
- [ ] App opened in browser → “Sign in to sync across devices” → Sign up / Sign in  
- [ ] Test: add an invoice, then sign in on another device and see the same data  

---

## If something goes wrong

- **“Sign in” or “Sign up” fails**  
  - Check that the **Project URL** and **anon key** in `config.js` match exactly what’s under Settings → API (no extra spaces, full key).

- **“Invalid API key” or network errors**  
  - Make sure you’re using the **anon public** key, not the service_role key.

- **Tables don’t exist / permission errors**  
  - Run **all** of `app/supabase-schema.sql` again in SQL Editor (it’s safe to run more than once).

- **Email confirmation required**  
  - Either confirm your email using the link Supabase sent, or turn off “Confirm email” in Authentication → Providers (Step 6).

---

You’re done. Your billing data is now stored in Supabase and will be the same on every device where you sign in.
