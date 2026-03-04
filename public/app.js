const sessionState = {
  startedAt: null,
};

const metroState = {
  timer: null,
  beat: 0,
  bpm: 80,
  smartRamp: true,
};

const ui = {
  pieceName: document.getElementById("piece-name"),
  baseBpm: document.getElementById("base-bpm"),
  notes: document.getElementById("notes"),
  smartRamp: document.getElementById("smart-ramp"),
  startSession: document.getElementById("start-session"),
  stopSession: document.getElementById("stop-session"),
  startMetro: document.getElementById("start-metro"),
  stopMetro: document.getElementById("stop-metro"),
  sessionStatus: document.getElementById("session-status"),
  metroStatus: document.getElementById("metro-status"),
  beatIndicator: document.getElementById("beat-indicator"),
  statMinutes: document.getElementById("stat-minutes"),
  statBpm: document.getElementById("stat-bpm"),
  statStreak: document.getElementById("stat-streak"),
  statSessions: document.getElementById("stat-sessions"),
  sessionsBody: document.getElementById("sessions-body"),
  heatmap: document.getElementById("heatmap"),
};

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString();
}

function levelForMinutes(minutes) {
  if (minutes >= 60) return 4;
  if (minutes >= 40) return 3;
  if (minutes >= 20) return 2;
  if (minutes > 0) return 1;
  return 0;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Request failed");
  }
  return res.json();
}

function clickSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 1100;
  gain.gain.value = 0.08;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.03);
}

function stopMetronome() {
  if (metroState.timer) {
    clearInterval(metroState.timer);
    metroState.timer = null;
  }
  ui.startMetro.disabled = false;
  ui.stopMetro.disabled = true;
  ui.metroStatus.textContent = "Metronome: idle";
}

function startMetronome() {
  stopMetronome();
  metroState.beat = 0;
  metroState.bpm = Number(ui.baseBpm.value);
  metroState.smartRamp = ui.smartRamp.checked;
  ui.startMetro.disabled = true;
  ui.stopMetro.disabled = false;

  const tick = () => {
    metroState.beat += 1;
    clickSound();
    ui.beatIndicator.textContent = `Beat: ${metroState.beat}`;
    ui.metroStatus.textContent = `Metronome: ${metroState.bpm} BPM`;

    if (metroState.smartRamp && metroState.beat % 16 === 0 && metroState.bpm < 240) {
      metroState.bpm += 2;
      clearInterval(metroState.timer);
      metroState.timer = setInterval(tick, (60 / metroState.bpm) * 1000);
    }
  };

  metroState.timer = setInterval(tick, (60 / metroState.bpm) * 1000);
}

async function refreshStats() {
  const stats = await api("/api/stats");
  ui.statMinutes.textContent = stats.totalMinutes;
  ui.statBpm.textContent = stats.avgBpm;
  ui.statStreak.textContent = stats.streak;
  ui.statSessions.textContent = stats.sessionCount;
}

function renderHeatmap(sessions) {
  const byDay = {};
  for (const s of sessions) {
    const day = s.started_at.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + s.minutes;
  }

  ui.heatmap.innerHTML = "";
  const today = new Date();
  for (let i = 97; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const minutes = byDay[key] || 0;
    const cell = document.createElement("div");
    cell.className = `cell level-${levelForMinutes(minutes)}`;
    cell.title = `${key}: ${minutes} minute(s)`;
    ui.heatmap.appendChild(cell);
  }
}

function renderSessions(sessions) {
  ui.sessionsBody.innerHTML = "";
  for (const s of sessions.slice(0, 12)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(s.started_at)}</td>
      <td>${s.piece_name}</td>
      <td>${s.minutes}</td>
      <td>${s.bpm}</td>
      <td>${s.notes || ""}</td>
    `;
    ui.sessionsBody.appendChild(tr);
  }
}

async function refreshSessions() {
  const sessions = await api("/api/sessions");
  renderSessions(sessions);
  renderHeatmap(sessions);
}

ui.startSession.addEventListener("click", () => {
  if (sessionState.startedAt) return;
  sessionState.startedAt = new Date();
  ui.sessionStatus.textContent = `Session: running since ${sessionState.startedAt.toLocaleTimeString()}`;
  ui.startSession.disabled = true;
  ui.stopSession.disabled = false;
});

ui.stopSession.addEventListener("click", async () => {
  if (!sessionState.startedAt) return;
  const endedAt = new Date();
  const minutes = Math.max(1, Math.round((endedAt - sessionState.startedAt) / 60000));
  const payload = {
    startedAt: sessionState.startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    minutes,
    pieceName: ui.pieceName.value.trim(),
    bpm: Number(ui.baseBpm.value),
    notes: ui.notes.value.trim(),
  };

  if (!payload.pieceName || !payload.bpm) {
    alert("Please fill piece and BPM before stopping.");
    return;
  }

  try {
    await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    sessionState.startedAt = null;
    ui.sessionStatus.textContent = "Session: idle";
    ui.startSession.disabled = false;
    ui.stopSession.disabled = true;
    await refreshStats();
    await refreshSessions();
  } catch (err) {
    alert(err.message);
  }
});

ui.startMetro.addEventListener("click", startMetronome);
ui.stopMetro.addEventListener("click", stopMetronome);

Promise.all([refreshStats(), refreshSessions()]).catch((err) => {
  ui.sessionStatus.textContent = `Error: ${err.message}`;
});
