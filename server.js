const path = require("path");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data.sqlite");
const db = new sqlite3.Database(DB_PATH);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      piece_name TEXT NOT NULL,
      bpm INTEGER NOT NULL,
      notes TEXT DEFAULT ''
    )
  `);
});

function getStats(rows) {
  const totalMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);
  const avgBpm = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.bpm, 0) / rows.length)
    : 0;

  const days = new Set(rows.map((row) => row.started_at.slice(0, 10)));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak += 1;
    } else if (i > 0) {
      break;
    }
  }

  return { totalMinutes, avgBpm, streak, sessionCount: rows.length };
}

app.get("/api/sessions", (_req, res) => {
  db.all(
    "SELECT * FROM sessions ORDER BY started_at DESC LIMIT 200",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      return res.json(rows);
    }
  );
});

app.post("/api/sessions", (req, res) => {
  const { startedAt, endedAt, minutes, pieceName, bpm, notes } = req.body;
  if (!startedAt || !endedAt || !minutes || !pieceName || !bpm) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const sql = `
    INSERT INTO sessions (started_at, ended_at, minutes, piece_name, bpm, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  db.run(
    sql,
    [startedAt, endedAt, minutes, pieceName.trim(), bpm, (notes || "").trim()],
    function onInsert(err) {
      if (err) return res.status(500).json({ error: err.message });
      return res.status(201).json({ id: this.lastID });
    }
  );
});

app.put("/api/sessions/:id", (req, res) => {
  const id = Number(req.params.id);
  const { pieceName, minutes, bpm, notes } = req.body;
  if (!id || !pieceName || !minutes || !bpm) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  db.run(
    `
    UPDATE sessions
    SET piece_name = ?, minutes = ?, bpm = ?, notes = ?
    WHERE id = ?
    `,
    [pieceName.trim(), Number(minutes), Number(bpm), (notes || "").trim(), id],
    function onUpdate(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) {
        return res.status(404).json({ error: "Session not found." });
      }
      return res.json({ ok: true });
    }
  );
});

app.delete("/api/sessions/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid session id." });

  db.run("DELETE FROM sessions WHERE id = ?", [id], function onDelete(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) {
      return res.status(404).json({ error: "Session not found." });
    }
    return res.json({ ok: true });
  });
});

app.get("/api/stats", (_req, res) => {
  db.all("SELECT * FROM sessions", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    return res.json(getStats(rows));
  });
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

function startServer(port = PORT) {
  return app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Practice app running at http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, db, getStats, startServer };
