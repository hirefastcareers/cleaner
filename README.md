# Home Rota

Shared weekly chore tracker for two people.

## Run it

```
npm install
npm run dev
```

Open http://localhost:3000.

For shared save/load against the real Supabase store: link the Vercel
`cleaner` project, pull env vars, then run the app:

```
npx vercel link --project cleaner
npx vercel env pull .env.local
npm run dev
```

## Deploy

The production app is the Vercel project **cleaner**
(https://cleaner-silk.vercel.app), with **Supabase** connected under
Storage. Tasks and History are stored in the `app_state` table
(`home-rota:tasks`, `home-rota:history`).

Push to `main` on the connected GitHub repo to deploy.
