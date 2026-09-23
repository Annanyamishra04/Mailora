# AI Mail Studio

An AI-powered email writing tool. Describe what you need to say, pick a tone and length, and get a ready-to-edit draft — generated using Google's Gemini AI. Supports generating new emails, replying to emails you've received, rewriting/polishing drafts, saving templates, and keeping a history of everything you've written. Accounts and data are handled by Supabase.

## Stack

Next.js · TypeScript · Tailwind CSS · Supabase (Auth + Database) · Google Gemini API

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables (`.env.local`)

| Variable | Required | Where to get it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Same page, "anon public" key |
| `GEMINI_API_KEY` | Yes | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | Recommended | Defaults to `gemini-3.5-flash` if unset |
| `SUPABASE_SERVICE_ROLE_KEY` | No — leave empty | Not used anywhere in the app; keep it unset |

## Supabase setup (one-time)

1. Create a free project at [supabase.com](https://supabase.com).
2. Copy the URL and anon key into `.env.local` (see table above).
3. Open the SQL Editor in the Supabase dashboard and run these 4 files, in order, from `supabase/migrations/`:
   - `0001_emails.sql`
   - `0002_emails_additional_instructions.sql`
   - `0003_templates.sql`
   - `0004_hardening.sql`
4. Under Authentication → URL Configuration, set your Site URL and add `<your-url>/auth/callback` to Redirect URLs (do this for both `http://localhost:3000` in dev and your live URL after deploying).

## Features

- **Compose** — describe an email, generate a draft, rewrite/polish it, save it
- **Reply** — paste an email you received, generate a reply
- **Templates** — built-in starter templates + your own saved ones
- **History** — search and revisit everything you've saved, mark favorites
- **Dashboard** — quick stats and recent activity
- **Autosave** — drafts save automatically while you type

## Deployment

Built for **Vercel + Supabase + Gemini**, all free-tier friendly.

1. Push this project to GitHub.
2. Import it into Vercel.
3. Add the same environment variables from `.env.local` to the Vercel project settings (leave `SUPABASE_SERVICE_ROLE_KEY` empty).
4. Deploy.
5. Add your Vercel URL + `/auth/callback` to Supabase's Redirect URLs.

## Notes

- Gemini's free tier occasionally returns a "high demand" error when Google's servers are busy — this is on Google's end, not the app. The app automatically retries a few times before giving up.
- Full technical documentation (architecture, security details, rate limiting, test checklist) has been trimmed from this file for readability. Ask if you need the detailed version back.