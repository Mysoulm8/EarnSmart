# EarnSmart v2 — Supabase-connected starter

EarnSmart is a responsive affiliate-link organizer for phones and computers. This version adds email/password registration, sign-in/sign-out, per-user cloud product storage, and per-user click-event counts using Supabase.

## Files
- `index.html` — application page
- `styles.css` — responsive design
- `app.js` — browser application and Supabase client
- `config.js` — public Supabase project URL and publishable key
- `manifest.webmanifest`, `icon.svg` — install metadata and icon

## 1. Configure Supabase
1. Open `config.js`.
2. Keep the Project URL as supplied for your EarnSmart project.
3. Replace `PASTE_YOUR_SB_PUBLISHABLE_KEY_HERE` with your project's **Publishable key** (starts with `sb_publishable_`).
4. Save the file.

The Project URL and publishable key are intended for browser use. Never put a Supabase `sb_secret_` key, service-role key, or database password in `config.js` or any GitHub Pages file.

## 2. Confirm your database
Run the EarnSmart SQL setup script in Supabase SQL Editor. It creates `profiles`, `products`, and `click_events`, enables Row Level Security, and creates the user-profile trigger. The browser app expects these columns:
- `profiles`: `id`, `display_name`, `created_at`
- `products`: `id`, `user_id`, `name`, `destination_url`, `description`, `is_active`, `created_at`
- `click_events`: `id`, `user_id`, `product_id`, `clicked_at`

If you used the SQL script from this project walkthrough and it returned “Success. No rows returned”, the schema is installed.

## 3. Configure authentication
In Supabase Dashboard:
1. Open **Authentication → URL Configuration**.
2. Set **Site URL** to `https://mysoulm8.github.io/EarnSmart/`.
3. Add this exact URL to **Redirect URLs**: `https://mysoulm8.github.io/EarnSmart/`.
4. For initial testing, leave email confirmation enabled if you can receive mail at the test address. After registration, open the confirmation email and then sign in.
5. Do not disable email confirmation for a public production app without considering the abuse and account-security implications.

## 4. Upload to GitHub Pages
1. Open your GitHub repository `mysoulm8/EarnSmart`.
2. Choose **Add file → Upload files**.
3. Upload all files from this `EarnSmart` folder, including the updated `index.html`, `app.js`, `styles.css`, and the new `config.js`.
4. Confirm `index.html` is in the repository root, not in a second nested `EarnSmart` folder.
5. Commit the changes to the `main` branch.
6. Wait for GitHub Pages to deploy, then reload `https://mysoulm8.github.io/EarnSmart/` (a hard refresh with Ctrl+F5 can help).

## 5. Test
1. Open the published website.
2. Create a test account using an email address you can access and a password of at least 8 characters.
3. If email confirmation is enabled, confirm the email.
4. Sign in.
5. Add a test product using an HTTPS destination URL you control or trust.
6. Sign out and sign in again; the product should still appear.
7. Do not test with real affiliate links until your affiliate program has approved you.

## Important limitations
- The app tracks clicks initiated through its own product buttons. It does not verify purchases, commissions, or payouts.
- Click events are associated with the signed-in account. This is not fraud-resistant analytics; users can still generate artificial clicks.
- Product records are private to each account. This version does not include a public product marketplace, admin console, payment processing, or payouts.
- The project uses the Supabase JavaScript library from a public CDN, so the browser needs an internet connection.
- Keep Supabase Row Level Security enabled. Never expose secret/service-role keys in frontend code.
