# Card Flasher

Simple flash card web app for learning English words and phrases.

## Features

- Local authentication (register/login/logout)
- Hybrid database support:
  - Local development: SQLite in `data/card-flasher.db`
  - Vercel/production: Postgres via `POSTGRES_URL` or `DATABASE_URL`
- Main card screen with reveal behavior:
  - initial view: phrase/word
  - reveal view: translation + English description/usage context
- Add cards screen with dynamic unlimited input fields
- AI card generation via Google Gemini (`gemini-2.5-flash`)
- Responsive UI for mobile and desktop

## Setup

- Install dependencies:

```bash
npm install
```

- Create environment file:

```bash
cp .env.example .env.local
```

- Add your Google API key to `.env.local`:

```bash
GOOGLE_API_KEY=your_key_here
```

- For Vercel deployment, add Postgres connection string env:

```bash
POSTGRES_URL=your_postgres_connection_string
# or DATABASE_URL=your_postgres_connection_string
```

- Start development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Flow

- Register or login.
- Set target translation language on main cards screen.
- Go to **Add cards**, enter one or more phrases.
- Click **Confirm cards**.
- App sends phrases to Google model and saves generated cards.
- Review cards and use **Reveal** / **Next card**.
