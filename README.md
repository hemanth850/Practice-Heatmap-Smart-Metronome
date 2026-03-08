# Practice Heatmap + Smart Metronome

MVP web app to track music practice sessions, visualize consistency, and train with a smart metronome.

## Features

- Session logging with piece name, BPM, minutes, and notes
- Edit/delete existing sessions
- Smart metronome with optional auto-ramp (+2 BPM every 16 beats)
- Dashboard cards: total minutes, average BPM, streak, session count
- 14x7 style heatmap over recent days
- SQLite persistence for local development

## Tech Stack

- Node.js + Express
- SQLite (`sqlite3`)
- Vanilla HTML/CSS/JavaScript frontend

## Run Locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## API

- `GET /api/sessions` -> latest sessions
- `POST /api/sessions` -> create session
- `PUT /api/sessions/:id` -> update session
- `DELETE /api/sessions/:id` -> remove session
- `GET /api/stats` -> aggregate stats

## Next Improvements

- Add delete/edit session actions
- Add weekly/monthly charts
- Add user profiles + cloud sync
