# Home Rota

Shared weekly chore tracker for two people.

## Run it

```
npm install
npm run dev
```

Open http://localhost:3000. Note: the task list won't load/save yet until
you connect a KV store (see below) — that's expected locally.

## Deploy

1. Push this folder to a GitHub repo.
2. Import it into Vercel (vercel.com → Add New Project → pick the repo → Deploy).
3. In the Vercel project → **Storage** tab → **Create Database** → **KV**.
   Connect it to this project. Vercel adds the required env vars automatically.
4. Redeploy if it doesn't happen automatically. Done — open the URL on both
   phones and add it to your Home Screens.

For local testing against the real shared store: `vercel link`, then
`vercel env pull .env.local`, then `npm run dev`.
