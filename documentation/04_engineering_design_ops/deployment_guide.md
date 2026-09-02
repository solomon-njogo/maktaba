# Environment Setup & Deployment Manual

## Local setup

1. Clone the repository.
2. Copy env template and fill in secrets:

```bash
cp src/.env.example src/.env.local
```

Required variables:

* `AIRTABLE_ACCESS_TOKEN`
* `AIRTABLE_BASE_ID`
* `GOOGLE_BOOKS_API_KEY`

3. Install and run the Next.js app (UI + `/api` Route Handlers):

```bash
cd src
npm install
npm run dev
```

The app is at `http://localhost:3000`. Health check: `GET /api/health`.

## Vercel

1. Project Settings → General → **Root Directory** = `src`.
2. Framework: Next.js.
3. Set the same environment variables for Production and Preview. Do not set `API_URL` to localhost.
4. Deploy. Confirm `GET /api/health` and `GET /api/books` on the deployment URL.
