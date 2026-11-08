# EarnSmart — zero-budget starter

EarnSmart is a responsive, static affiliate-link organizer. It runs in a browser on Android phones and computers.

## Included in this first version
- Responsive mobile/desktop interface
- Add and remove product destination links
- Local click counter (counts clicks initiated from this browser only)
- Shareable page URL
- Browser-local storage
- Sample content and clear monetization disclosures

## Important limitations
This is a front-end starter, not a complete money-making platform:
- There is no user account system, cloud database, server, admin login, or payment/payout system.
- Data is stored only in the current browser on the current device. Clearing browser data can erase it.
- Click counts are local UI activity, not verified affiliate clicks or purchases.
- Real commissions require approval from an affiliate program and its official tracking URLs. The affiliate provider confirms sales and payouts.
- Do not promise rewards or income to users based on unverified activity.

## Run it on your computer
1. Download and unzip `EarnSmart.zip`.
2. Open the `EarnSmart` folder.
3. Double-click `index.html` to open it in a modern browser.
4. Add your own approved affiliate product URLs.

## Publish for free with GitHub Pages
1. Create or sign in to a GitHub account.
2. Create a new **public** repository named `earnsmart` (or another name).
3. Upload all files from this folder to the repository root. Keep `index.html` at the root.
4. Open repository **Settings → Pages**.
5. Under Build and deployment, choose **Deploy from a branch**, select `main` and `/ (root)`, then Save.
6. Wait for GitHub Pages to publish the site. The Pages screen will show the public URL.
7. Open that URL on your Android phone or computer.

GitHub Pages hosts static files only. It does not provide private user accounts or a secure database.

## Customize
- Edit product starter examples in `app.js`.
- Change colors and layout in `styles.css`.
- Change page text in `index.html`.
- Test with your own affiliate URL before sharing.

## Before public launch
1. Join an affiliate program directly and read its terms.
2. Replace all sample `example.com` links with your own approved tracking links.
3. Add a clear affiliate disclosure near product recommendations.
4. Publish a privacy notice if you later collect personal data.
5. For multiple users, real click analytics, verified referrals, or payouts, add a secure backend and server-side validation. Never store passwords, OTPs, or payment credentials in browser local storage.
