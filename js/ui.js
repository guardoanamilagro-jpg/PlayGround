import { MAPS, MAP_ORDER } from './world.js';
import { SPECIES, HIDER_PLAYABLE, SEEKER_PLAYABLE } from './animals.js';

export function formatTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export class UI {
  constructor(callbacks = {}) {
    this.cb = callbacks;
    this.portraits = {};
    this.renderedRole = null;
    this.config = { role: 'hider', species: 'monkey', mapId: 'jungle' };
    this.toastTimer = 0;
    this.last = {};
    this.buildMaps();
    this.bind();
  }

  $(id) { return document.getElementById(id); }

  buildMaps() {
    this.$('map-grid').innerHTML = MAP_ORDER.map((id) => {
      const m = MAPS[id];
      return `<button class="map-card ${id}" data-map="${id}" aria-label="${m.name}">
        <span class="art"></span><span class="mtag">${m.tag}</span><span class="mname">${m.name}</span>
      </button>`;
    }).join('');
  }

  buildAnimalCards(role) {
    const list = role === 'hider' ? HIDER_PLAYABLE : SEEKER_PLAYABLE;
    const grid = this.$('animal-grid');
    grid.classList.toggle('two', role === 'seeker');
    grid.innerHTML = list.map((id) => {
      const s = SPECIES[id];
      const ability = s.ability === 'none' ? 'SIN PODER' : s.abilityName.split(' ')[0];
      return `<button class="animal-card" data-species="${id}" aria-label="${s.name}">
        <span class="check"></span>
        <span class="portrait"><img data-portrait="${id}" alt="" /><span class="fallback">${s.emoji}</span></span>
        <span class="aname">${s.name}</span>
        <span class="aability">${ability}</span>
      </button>`;
    }).join('');
    this.applyPortraits();
  }

  applyPortraits() {
    document.querySelectorAll('img[data-portrait]').forEach((img) => {
      const id = img.dataset.portrait;
      if (this.portraits[id] && img.src !== this.portraits[id]) img.src = this.portraits[id];
    });
  }

  setPortraits(map) {
    this.portraits = map || {};
    this.applyPortraits();
    this.updateAsidePortrait();
  }

  bind() {
    const cb = this.cb;
    this.$('role-switch').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-role]');
      if (!btn) return;
      cb.onRole?.(btn.dataset.role);
    });
    this.$('animal-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-species]');
      if (!btn) return;
      cb.onSpecies?.(btn.dataset.species);
    });
    this.$('map-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-map]');
      if (!btn) return;
      cb.onMap?.(btn.dataset.map);
    });
    this.$('play-btn').addEventListener('click', () => cb.onPlay?.());
    this.$('how-btn').addEventListener('click', () => cb.onHow?.());
    this.$('how-close').addEventListener('click', () => this.hideHow());
    this.$('how').addEventListener('click', (e) => { if (e.target === this.$('how')) this.hideHow(); });
    this.$('sound-btn').addEventListener('click', () => cb.onSound?.());
    this.$('fullscreen-btn').addEventListener('click', () => cb.onFullscreen?.());
    this.$('resume-btn').addEventListener('click', () => cb.onResume?.());
    this.$('quit-btn').addEventListener('click', () => cb.onQuit?.());
    this.$('rematch-btn').addEventListener('click', () => cb.onRematch?.());
    this.$('menu-btn').addEventListener('click', () => cb.onMenu?.());
    this.$('round-continue').addEventListener('click', () => cb.onContinue?.());
  }

  renderMenu(config) {
    this.config = config;
    const role = config.role;
    document.querySelectorAll('#role-switch .role-option').forEach((el) => {
      el.classList.toggle('active', el.dataset.role === role);
      el.setAttribute('aria-selected', el.dataset.role === role ? 'true' : 'false');
    });
    if (this.renderedRole !== role) {
      this.renderedRole = role;
      this.buildAnimalCards(role);
    }
    document.querySelectorAll('#animal-grid .animal-card').forEach((el) => {
      el.classList.toggle('active', el.dataset.species === config.species);
    });
    document.querySelectorAll('#map-grid .map-card').forEach((el) => {
      el.classList.toggle('active', el.dataset.map === config.mapId);
    });
    const s = SPECIES[config.species];
    const m = MAPS[config.mapId];
    this.$('animal-hint').textContent = role === 'hider' ? 'SOBREVIVE 4 MINUTOS' : 'ELIMINA A LAS 9 PRESAS';
    this.$('animal-label').textContent = role === 'hider' ? 'TU ANIMAL ESCONDIDO' : 'TU ANIMAL CAZADOR';
    this.$('aside-map-name').textContent = m.name;
    this.$('aside-map-desc').textContent = m.desc;
    this.$('aside-map-temp').textContent = m.tag;
    this.$('aside-map-size').textContent = m.size;
    this.$('aside-species-name').textContent = s.name;
    this.$('aside-species-role').textContent = s.role;
    this.$('aside-species-ability').innerHTML = `<b>${s.abilityName.charAt(0) + s.abilityName.slice(1).toLowerCase()}.</b> ${s.blurb}`;
    this.$('stat-speed').style.width = `${Math.min(100, ((s.speed - 4.8) / 3.2) * 100)}%`;
    this.$('stat-stealth').style.width = `${s.stealth}%`;
    this.updateAsidePortrait();
  }

  updateAsidePortrait() {
    const host = this.$('aside-portrait');
    if (!host) return;
    const id = this.config.species;
    const src = this.portraits[id];
    if (src) host.innerHTML = `<img src="${src}" alt="${SPECIES[id]?.name || ''}">`;
    else host.innerHTML = `<span style="display:grid;place-items:center;height:100%;font-size:23px">${SPECIES[id]?.emoji || ''}</span>`;
  }

  showMenu() {
    this.$('menu').classList.remove('hidden');
    this.$('hud').classList.add('hidden');
    this.$('phase').classList.add('hidden');
    this.$('round-end').classList.add('hidden');
    this.$('match-end').classList.add('hidden');
    this.$('pause').classList.add('hidden');
    this.$('spectate').classList.add('hidden');
    this.$('mobile-controls').classList.add('hidden');
  }

  hideMenu() { this.$('menu').classList.add('hidden'); }

  showHud(mapName) {
    this.$('hud').classList.remove('hidden');
    this.$('map-name').textContent = mapName;
    this.$('mobile-controls').classList.toggle('hidden', !document.body.classList.contains('touch'));
  }

  hideHud() { this.$('hud').classList.add('hidden'); }

  setScores(hider, seeker) {
    const key = `${hider}-${seeker}`;
    if (this.last.scores === key) return;
    this.last.scores = key;
    const pips = (n) => [0, 1, 2].map((i) => `<span class="pip ${i < n ? 'on' : ''}"></span>`).join('');
    this.$('hider-pips').innerHTML = pips(hider);
    this.$('seeker-pips').innerHTML = pips(seeker);
  }

  updateHud(st) {
    const t = this.$('timer');
    const timeText = formatTime(st.time);
    if (this.last.time !== timeText) { t.textContent = timeText; this.last.time = timeText; }
    t.classList.toggle('danger', st.phase === 'hunt' && st.time <= 30);
    const phaseText = st.phase === 'hide' ? 'FASE DE ESCONDITE' : st.phase === 'hunt' ? 'LA CAZA' : 'RONDA FINALIZADA';
    if (this.last.phase !== phaseText) {
      this.$('phase-label').textContent = phaseText;
      this.$('phase-label').classList.toggle('danger', st.phase === 'hunt' && st.time <= 30);
      this.last.phase = phaseText;
    }
    const roundText = `RONDA ${st.round} · AL MEJOR DE 5`;
    if (this.last.round !== roundText) { this.$('round-label').textContent = roundText; this.last.round = roundText; }
    if (this.last.alive !== st.alive) {
      this.$('alive-num').textContent = st.alive;
      this.last.alive = st.alive;
    }
    if (this.last.objective !== st.objective) {
      this.$('objective').textContent = st.objective || '';
      this.last.objective = st.objective;
    }
    this.setStatus(st.status, st.statusMode);
    this.setAbility(st.ability);
    const stamina = Math.round(st.stamina);
    if (this.last.stamina !== stamina) {
      this.$('stamina-fill').style.width = `${stamina}%`;
      this.$('stamina-fill').classList.toggle('low', stamina < 26);
      this.last.stamina = stamina;
    }
    const spec = this.$('spectate');
    spec.classList.toggle('hidden', !st.spectating);
  }

  setStatus(text, mode) {
    const key = `${text}|${mode}`;
    if (this.last.status === key) return;
    this.last.status = key;
    const el = this.$('status-pill');
    el.textContent = text;
    el.className = 'status-pill' + (mode === 'hidden' ? ' hidden-state' : mode === 'danger' ? ' danger-state' : '');
  }

  setAbility(a) {
    if (!a) return;
    const key = `${a.name}|${a.key}|${a.desc}|${a.active}|${a.ready}`;
    if (this.last.ability !== key) {
      this.last.ability = key;
      this.$('ability-name').textContent = a.name;
      this.$('ability-desc').textContent = a.desc;
      this.$('ability-icon').textContent = a.key || '—';
      document.querySelector('#ability-card .ability-key').innerHTML = a.key && a.key !== '—' ? `HABILIDAD <kbd>${a.key}</kbd>` : 'HABILIDAD';
      this.$('ability-card').classList.toggle('cooling', !a.ready);
    }
    const pct = a.total > 0 ? Math.max(0, Math.min(1, a.ratio)) : 1;
    const w = `${Math.round(pct * 100)}%`;
    if (this.last.cool !== w) { this.$('ability-cool').style.width = w; this.last.cool = w; }
  }

  toast(text, cls = '', sub = '', duration = 2.2) {
    const el = this.$('toast');
    el.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    el.className = `toast show ${cls}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.className = 'toast'; }, duration * 1000);
  }

  feed(html) {
    const wrap = this.$('feed');
    const d = document.createElement('div');
    d.className = 'feed-item';
    d.innerHTML = html;
    wrap.appendChild(d);
    while (wrap.children.length > 4) wrap.removeChild(wrap.firstChild);
    setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .4s'; setTimeout(() => d.remove(), 420); }, 5200);
  }

  clearFeed() { this.$('feed').innerHTML = ''; }

  showBlackout(remaining) {
    const p = this.$('phase');
    p.classList.remove('hidden', 'countdown');
    p.classList.add('blackout');
    const big = formatTime(remaining);
    if (this.last.blackout !== big) {
      this.last.blackout = big;
      this.$('phase-kicker').textContent = 'PANTALLA A OSCURAS';
      this.$('phase-big').textContent = big;
      this.$('phase-sub').textContent = 'Los escondidos están tomando posiciones';
      this.$('radar').style.display = 'block';
    }
  }

  showCountdown(big, kicker, sub) {
    const p = this.$('phase');
    p.classList.remove('hidden', 'blackout');
    p.classList.add('countdown');
    this.$('phase-kicker').textContent = kicker || '';
    this.$('phase-big').textContent = big;
    this.$('phase-sub').textContent = sub || '';
    this.$('radar').style.display = 'none';
  }

  hidePhase() {
    this.$('phase').classList.add('hidden');
    this.$('phase').classList.remove('blackout', 'countdown');
  }

  showRoundEnd(data) {
    this.$('round-end').classList.remove('hidden');
    this.$('round-kicker').textContent = `RONDA ${data.round} FINALIZADA`;
    this.$('round-title').textContent = data.winner === 'hider' ? 'GANAN LOS ESCONDIDOS' : 'GANAN LOS CAZADORES';
    this.$('round-sub').textContent = data.sub;
    this.$('round-hider-score').textContent = data.hiderScore;
    this.$('round-seeker-score').textContent = data.seekerScore;
    this.$('round-next').innerHTML = data.final ? 'RESULTADO FINAL…' : `SIGUIENTE RONDA EN <b>${data.countdown}</b>`;
    this.last.roundCountdown = data.countdown;
    this.last.roundFinal = data.final;
  }

  updateRoundCountdown(n) {
    if (this.last.roundFinal) return;
    if (this.last.roundCountdown === n) return;
    this.last.roundCountdown = n;
    this.$('round-next').innerHTML = `SIGUIENTE RONDA EN <b>${n}</b>`;
  }

  hideRoundEnd() { this.$('round-end').classList.add('hidden'); }

  showMatchEnd(data) {
    this.$('match-end').classList.remove('hidden');
    this.$('match-title').textContent = data.playerWon ? 'VICTORIA' : 'DERROTA';
    this.$('match-title').style.color = data.playerWon ? 'var(--acid)' : 'var(--coral)';
    this.$('match-sub').textContent = data.sub;
    this.$('match-hider-score').textContent = data.hiderScore;
    this.$('match-seeker-score').textContent = data.seekerScore;
    this.$('match-stats').innerHTML = data.stats;
  }

  hideMatchEnd() { this.$('match-end').classList.add('hidden'); }

  showPause(show) { this.$('pause').classList.toggle('hidden', !show); }
  hidePause() { this.showPause(false); }

  showHow() { this.$('how').classList.remove('hidden'); }
  hideHow() { this.$('how').classList.add('hidden'); }

  flash() {
    const f = this.$('flash');
    f.classList.remove('fire');
    void f.offsetWidth;
    f.classList.add('fire');
    setTimeout(() => f.classList.remove('fire'), 55);
  }

  setMuted(muted) {
    this.$('sound-btn').classList.toggle('off', muted);
  }

  get minimap() { return this.$('minimap'); }
}
