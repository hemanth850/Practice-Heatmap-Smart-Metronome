const STORAGE_KEY = 'hemanths-studio-sessions-v1';
const state = { sessions: loadSessions(), startedAt: null, timer: null, bpm: 80, beats: 4, beat: 0, metroTimer: null, audio: null, ramp: false };
const el = Object.fromEntries(['pieceInput','notesInput','timer','sessionButton','finishButton','sessionState','tempoValue','tempoSlider','beatsSelect','rampInput','beatLights','metroButton','metroState','totalMinutes','streakValue','averageTempo','sessionCount','heatmap','historyList','historySummary','clearData'].map((id) => [id, document.getElementById(id)]));

function loadSessions() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function saveSessions() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.sessions)); }
function formatDuration(seconds) { const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return [h, m, s].map((value) => String(value).padStart(2, '0')).join(':'); }
function dayKey(date) { const local = new Date(date); return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`; }
function formatDate(value) { return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(value)); }
function setSessionState(running) { el.sessionState.textContent = running ? 'In progress' : 'Ready'; el.sessionState.classList.toggle('active', running); el.sessionButton.disabled = running; el.finishButton.disabled = !running; }

function startSession() {
  state.startedAt = Date.now();
  state.timer = window.setInterval(() => { el.timer.textContent = formatDuration(Math.floor((Date.now() - state.startedAt) / 1000)); }, 1000);
  el.timer.textContent = '00:00:00'; setSessionState(true);
}
function finishSession() {
  if (!state.startedAt) return;
  const elapsed = Math.max(60, Math.round((Date.now() - state.startedAt) / 1000));
  state.sessions.unshift({ id: crypto.randomUUID(), startedAt: new Date(state.startedAt).toISOString(), seconds: elapsed, title: el.pieceInput.value.trim() || 'Untitled practice', bpm: state.bpm, notes: el.notesInput.value.trim() });
  saveSessions(); window.clearInterval(state.timer); state.startedAt = null; state.timer = null; el.timer.textContent = '00:00:00'; el.notesInput.value = ''; setSessionState(false); renderInsights();
}

function setTempo(value) { state.bpm = Math.max(35, Math.min(240, Number(value))); el.tempoValue.textContent = state.bpm; el.tempoSlider.value = state.bpm; }
function ensureAudio() { if (!state.audio) state.audio = new (window.AudioContext || window.webkitAudioContext)(); return state.audio.resume().then(() => state.audio); }
function playClick(accent) { const context = state.audio; const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = accent ? 1120 : 780; gain.gain.setValueAtTime(accent ? .15 : .09, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .07); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .08); }
function paintBeat() { [...el.beatLights.children].forEach((light, index) => light.classList.toggle('current', index === state.beat)); }
function renderBeats() { el.beatLights.replaceChildren(...Array.from({ length: state.beats }, () => Object.assign(document.createElement('span'), { className: 'beat-light' }))); paintBeat(); }
function stopMetronome() { if (state.metroTimer) window.clearTimeout(state.metroTimer); state.metroTimer = null; state.beat = 0; el.metroButton.textContent = 'Start metronome'; el.metroState.textContent = 'Silent'; el.metroState.classList.remove('active'); renderBeats(); }
async function startMetronome() {
  await ensureAudio(); state.beat = 0; state.ramp = el.rampInput.checked; let totalBeats = 0; el.metroButton.textContent = 'Stop metronome'; el.metroState.textContent = `${state.bpm} BPM`; el.metroState.classList.add('active');
  const tick = () => { const accent = state.beat === 0; playClick(accent); paintBeat(); state.beat = (state.beat + 1) % state.beats; totalBeats += 1; if (state.ramp && totalBeats % 16 === 0) setTempo(state.bpm + 2); el.metroState.textContent = `${state.bpm} BPM`; state.metroTimer = window.setTimeout(tick, 60000 / state.bpm); }; tick();
}

function sessionMinutes(session) { return Math.max(1, Math.round(session.seconds / 60)); }
function stats() {
  const minutes = state.sessions.reduce((sum, session) => sum + sessionMinutes(session), 0);
  const average = state.sessions.length ? Math.round(state.sessions.reduce((sum, session) => sum + session.bpm, 0) / state.sessions.length) : null;
  const practiced = new Set(state.sessions.map((session) => dayKey(session.startedAt))); let streak = 0; const cursor = new Date();
  if (!practiced.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (practiced.has(dayKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
  return { minutes, average, streak };
}
function level(minutes) { if (!minutes) return 0; if (minutes < 15) return 1; if (minutes < 35) return 2; if (minutes < 60) return 3; return 4; }
function renderHeatmap() {
  const byDay = new Map(); state.sessions.forEach((session) => byDay.set(dayKey(session.startedAt), (byDay.get(dayKey(session.startedAt)) || 0) + sessionMinutes(session))); el.heatmap.replaceChildren();
  for (let offset = 83; offset >= 0; offset -= 1) { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - offset); const minutes = byDay.get(dayKey(date)) || 0; const cell = document.createElement('span'); cell.className = `heat-cell level-${level(minutes)}`; cell.title = `${formatDate(date)}: ${minutes} minute${minutes === 1 ? '' : 's'}`; cell.setAttribute('aria-label', cell.title); el.heatmap.append(cell); }
}
function renderHistory() {
  el.historyList.replaceChildren(); if (!state.sessions.length) { el.historyList.innerHTML = '<p class="empty-history">Finish a session to start building your history.</p>'; return; }
  state.sessions.slice(0, 8).forEach((session) => { const item = document.createElement('article'); item.className = 'history-item'; item.innerHTML = `<div><strong>${escapeHtml(session.title)}</strong><span>${formatDate(session.startedAt)} &middot; ${sessionMinutes(session)} min &middot; ${session.bpm} BPM</span>${session.notes ? `<p>${escapeHtml(session.notes)}</p>` : ''}</div><button type="button" data-delete="${session.id}" aria-label="Delete ${escapeHtml(session.title)} session">Remove</button>`; el.historyList.append(item); });
}
function escapeHtml(value) { const node = document.createElement('span'); node.textContent = value; return node.innerHTML; }
function renderInsights() { const summary = stats(); el.totalMinutes.textContent = summary.minutes >= 60 ? `${Math.floor(summary.minutes / 60)}h ${summary.minutes % 60}m` : `${summary.minutes}m`; el.streakValue.textContent = `${summary.streak} ${summary.streak === 1 ? 'day' : 'days'}`; el.averageTempo.textContent = summary.average ? `${summary.average} BPM` : '--'; el.sessionCount.textContent = state.sessions.length; el.historySummary.textContent = state.sessions.length ? `${state.sessions.length} saved session${state.sessions.length === 1 ? '' : 's'} on this device.` : 'Your completed sessions will appear here.'; renderHeatmap(); renderHistory(); }

el.sessionButton.addEventListener('click', startSession); el.finishButton.addEventListener('click', finishSession);
document.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => setTempo(state.bpm + Number(button.dataset.step))));
el.tempoSlider.addEventListener('input', () => setTempo(el.tempoSlider.value)); el.beatsSelect.addEventListener('change', () => { state.beats = Number(el.beatsSelect.value); renderBeats(); });
el.metroButton.addEventListener('click', () => state.metroTimer ? stopMetronome() : startMetronome());
el.historyList.addEventListener('click', (event) => { const button = event.target.closest('[data-delete]'); if (!button) return; state.sessions = state.sessions.filter((session) => session.id !== button.dataset.delete); saveSessions(); renderInsights(); });
el.clearData.addEventListener('click', () => { if (!state.sessions.length || !window.confirm('Clear all practice history stored in this browser?')) return; state.sessions = []; saveSessions(); renderInsights(); });
window.addEventListener('beforeunload', stopMetronome); renderBeats(); renderInsights();
