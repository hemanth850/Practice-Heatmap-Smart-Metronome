# Hemanth's Studio

A private, browser-based music practice timer, smart metronome, and consistency heatmap.

Sessions are kept only in the browser's local storage. There are no accounts, server database, analytics, or hosted user data.

## Features

- Practice timer and quick session notes
- Audible metronome with accented downbeats
- Optional tempo building: +2 BPM every 16 beats
- Local-only session history, streaks, totals, and average tempo
- Twelve-week practice heatmap
- One-click removal of individual sessions or all local history

## Run locally

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run deploy
```

The Cloudflare static-assets configuration publishes `public/`. After the first deploy, connect `studio.hemanthga.com` as a custom domain in the Worker settings.

## Search visibility

The static page includes a canonical URL, metadata, structured WebApplication data, `robots.txt`, and a sitemap. After the domain is live, submit `https://studio.hemanthga.com/sitemap.xml` in Google Search Console.

## Archived backend

The former Express and SQLite implementation remains in repository history and `server.js`, but is no longer part of the deployed product.
