// ==========================================================================
// WAVE FIGHT - pick a fighter, survive endless waves
// ==========================================================================
(() => {
    'use strict';

    // ---------------- data ----------------
    const WAVE_KEY = 'teasbogre_wave_best';

    // hp / speed (px per frame at 60fps) / dmg per hit. pips are for the select screen only.
    const CHARS = [
        { id: 'untitled', name: '[untitled]', hp: 100, speed: 4.2, dmg: 10, weapon: '🗡️', color: '#00ff66', pips: { hp: 3, spd: 5, dmg: 3 } },
        { id: '342',      name: '342',        hp: 170, speed: 2.2, dmg: 18, weapon: '🔨', color: '#ff0055', pips: { hp: 5, spd: 1, dmg: 5 } },
        { id: 'ota',      name: 'ota',        hp: 65,  speed: 3.2, dmg: 6,  weapon: '🏏', color: '#00ccff', pips: { hp: 2, spd: 3, dmg: 2 } },
        { id: 'meemo',    name: 'meemo',      hp: 100, speed: 3.2, dmg: 10, weapon: '🔱', color: '#ffcc00', pips: { hp: 3, spd: 3, dmg: 3 } }
    ];

    // bonus buttons: one more joins every wave after wave 7, in this order
    const BONUS = ['characters', 'pilot', 'chapters', 'teasbogre', 'mikmiko', 'avant_gard',
                   'ethernet teas', 'miert jatszol meg', 'hagyd abba', 'eleg.'];
    const BONUS_WEAPONS = ['⚔️', '🪓', '🔨', '🗡️', '🏹', '🔱', '🥊', '🧹', '⛏️', '🔥'];
    const BONUS_START_WAVE = 8;

    // ---------------- tuning ----------------
    const TOP = 70;                 // top strip kept free for the HUD
    const ENEMY_SPEED_FACTOR = 0.62;
    const ENEMY_DMG_FACTOR = 0.8;
    const ENEMY_CD = 1100;          // ms between enemy attacks
    const ENEMY_WINDUP = 320;       // ms telegraph before an enemy hit lands
    const ENEMY_REACH = 26;         // px gap in which an enemy can attack
    const PLAYER_ATK_CD = 420;
    const PLAYER_ATK_RANGE = 85;
    const PLAYER_IFRAMES = 250;
    const WAVE_HEAL = 0.3;          // fraction of max hp restored when a wave is cleared

    // ---------------- helpers ----------------
    const pips = n => '■'.repeat(n) + '□'.repeat(5 - n);
    const isTouchDevice = () =>
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    function getBestWave() {
        try { const v = localStorage.getItem(WAVE_KEY); if (v) return parseInt(v, 10) || 0; } catch (e) {}
        const m = document.cookie.match(new RegExp('(?:^|; )' + WAVE_KEY + '=(\\d+)'));
        return m ? parseInt(m[1], 10) : 0;
    }
    function setBestWave(n) {
        try { localStorage.setItem(WAVE_KEY, String(n)); } catch (e) {}
        document.cookie = `${WAVE_KEY}=${n}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
    }
    function clearBestWave() {
        try { localStorage.removeItem(WAVE_KEY); } catch (e) {}
        document.cookie = `${WAVE_KEY}=; max-age=0; path=/`;
    }

    let audioCtx = null;
    function beep(freq, dur, type = 'square', vol = 0.05) {
        try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = type; o.frequency.value = freq;
            g.gain.setValueAtTime(vol, audioCtx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
            o.connect(g).connect(audioCtx.destination);
            o.start(); o.stop(audioCtx.currentTime + dur);
        } catch (e) {}
    }

    // ---------------- DOM ----------------
    const startBtn = document.getElementById('fight-start-btn');
    if (!startBtn) return; // not on a page with the comics menu

    const overlay = document.createElement('div');
    overlay.id = 'fight-overlay';
    overlay.className = 'fight-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
        <button type="button" class="fight-quit" aria-label="Quit fight">&times;</button>

        <section class="fight-select" id="fight-select">
            <h2 class="fight-title">CHOOSE YOUR FIGHTER</h2>
            <div class="fight-cards" id="fight-cards"></div>
            <p class="fight-best">BEST WAVE: <span id="fight-best-wave">0</span>
                <button type="button" class="reset-best-btn" id="reset-wave-btn">RESET</button></p>
            <p class="fight-help">move: mouse &middot; attack: click or hold &middot; esc: quit</p>
        </section>

        <section class="fight-play is-hidden" id="fight-play">
            <div class="fight-hud">
                <span class="hud-name" id="hud-name"></span>
                <div class="hud-hpwrap"><div class="hud-hpfill" id="hud-hpfill"></div><div class="hud-hptext" id="hud-hptext"></div></div>
                <span class="hud-stat hud-wave" id="hud-wave">WAVE 1</span>
                <span class="hud-stat hud-left" id="hud-left"></span>
            </div>
            <div class="fight-arena" id="fight-arena"></div>
            <div class="fight-banner" id="fight-banner"></div>
            <div class="fight-over is-hidden" id="fight-over">
                <h2>YOU DIED 💀</h2>
                <p id="fight-over-text"></p>
                <div class="fight-over-btns">
                    <button type="button" id="over-retry">RETRY</button>
                    <button type="button" id="over-chars">CHARACTERS</button>
                    <button type="button" id="over-quit">QUIT</button>
                </div>
            </div>
        </section>

        <div class="fight-vignette"></div>`;
    document.body.appendChild(overlay);

    const $ = id => overlay.querySelector('#' + id);
    const selectEl = $('fight-select'), playEl = $('fight-play'), arenaEl = $('fight-arena');
    const cardsEl = $('fight-cards'), bestWaveEl = $('fight-best-wave'), resetWaveBtn = $('reset-wave-btn');
    const hudName = $('hud-name'), hudFill = $('hud-hpfill'), hudText = $('hud-hptext');
    const hudWave = $('hud-wave'), hudLeft = $('hud-left');
    const bannerEl = $('fight-banner'), overEl = $('fight-over'), overText = $('fight-over-text');

    const toast = document.createElement('div');
    toast.className = 'fight-toast';
    document.body.appendChild(toast);
    let toastTimer = null;
    function showToast(text, ms = 3000) {
        toast.textContent = text;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
    }

    // character cards
    CHARS.forEach(c => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'fight-card';
        b.style.setProperty('--c', c.color);
        b.innerHTML = `
            <h3></h3>
            <div class="weapon-hint">${c.weapon} fighter</div>
            <div class="stat"><span>HP</span><span class="pips">${pips(c.pips.hp)}</span></div>
            <div class="stat"><span>SPD</span><span class="pips">${pips(c.pips.spd)}</span></div>
            <div class="stat"><span>DMG</span><span class="pips">${pips(c.pips.dmg)}</span></div>`;
        b.querySelector('h3').textContent = c.name;
        b.addEventListener('click', () => startGame(c.id));
        cardsEl.appendChild(b);
    });

    // ---------------- state ----------------
    const S = {
        open: false, running: false, ended: false, transition: false,
        wave: 0, charId: null, player: null, enemies: [],
        raf: 0, last: 0, timeouts: [],
        mouse: { x: 0, y: 0, down: false }
    };

    const later = (fn, ms) => { const id = setTimeout(fn, ms); S.timeouts.push(id); return id; };
    const clearLater = () => { S.timeouts.forEach(clearTimeout); S.timeouts = []; };

    const arenaW = () => arenaEl.clientWidth || window.innerWidth;
    const arenaH = () => arenaEl.clientHeight || window.innerHeight;

    // ---------------- open / close ----------------
    function updateBestWaveDisplay() { bestWaveEl.textContent = String(getBestWave()); }

    function showSelect() {
        stopLoop();
        clearLater();
        arenaEl.innerHTML = '';
        S.player = null; S.enemies = [];
        overEl.classList.add('is-hidden');
        playEl.classList.add('is-hidden');
        selectEl.classList.remove('is-hidden');
        updateBestWaveDisplay();
    }

    function openFight() {
        if (startBtn.classList.contains('is-locked')) return; // not unlocked yet
        if (isTouchDevice()) {
            showToast('BATTLE MODE IS UNFORTUNATELY NOT AVAILABLE ON MOBILE YET! 📱');
            return;
        }
        const modal = document.getElementById('comics-modal');
        if (modal && modal.classList.contains('battle-dark')) return; // hold-fight in progress
        S.open = true;
        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
        document.documentElement.style.overflow = 'hidden';
        showSelect();
    }

    function closeFight() {
        S.open = false;
        stopLoop();
        clearLater();
        arenaEl.innerHTML = '';
        S.player = null; S.enemies = [];
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
        document.documentElement.style.overflow = '';
    }

    startBtn.addEventListener('click', openFight);
    overlay.querySelector('.fight-quit').addEventListener('click', closeFight);
    $('over-quit').addEventListener('click', closeFight);
    $('over-chars').addEventListener('click', showSelect);
    $('over-retry').addEventListener('click', () => startGame(S.charId));
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && S.open) closeFight();
    });

    // reset best wave (two-step confirm)
    let resetTimer = null;
    resetWaveBtn.addEventListener('click', () => {
        if (!resetWaveBtn.classList.contains('confirming')) {
            resetWaveBtn.classList.add('confirming');
            resetWaveBtn.textContent = 'SURE?';
            clearTimeout(resetTimer);
            resetTimer = setTimeout(() => {
                resetWaveBtn.classList.remove('confirming');
                resetWaveBtn.textContent = 'RESET';
            }, 2500);
            return;
        }
        clearTimeout(resetTimer);
        resetWaveBtn.classList.remove('confirming');
        resetWaveBtn.textContent = 'RESET';
        clearBestWave();
        updateBestWaveDisplay();
    });

    // ---------------- input ----------------
    const setMouse = e => { S.mouse.x = e.clientX; S.mouse.y = e.clientY; };
    overlay.addEventListener('pointermove', setMouse);
    arenaEl.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        setMouse(e);
        S.mouse.down = true;
    });
    window.addEventListener('pointerup', () => { S.mouse.down = false; });
    window.addEventListener('pointercancel', () => { S.mouse.down = false; });
    window.addEventListener('blur', () => { S.mouse.down = false; });
    arenaEl.addEventListener('contextmenu', e => e.preventDefault());

    // ---------------- fighters ----------------
    function place(f) { f.el.style.transform = `translate(${f.x}px, ${f.y}px)`; }
    function setBar(f) { f.bar.style.width = Math.max(0, f.hp / f.maxHp * 100) + '%'; }

    function createFighter(def, isPlayer, x, y, extra) {
        const el = document.createElement('div');
        el.className = 'fighter ' + (isPlayer ? 'is-player' : 'is-enemy');
        el.innerHTML = `<div class="f-bar"><i></i></div>` +
            (isPlayer ? '' : `<span class="f-weapon"></span>`) + `<span class="f-name"></span>`;
        el.querySelector('.f-name').textContent = def.name;
        if (!isPlayer) el.querySelector('.f-weapon').textContent = def.weapon;
        arenaEl.appendChild(el);

        const f = Object.assign({
            el, bar: el.querySelector('.f-bar i'), weaponEl: el.querySelector('.f-weapon'),
            x, y, w: el.offsetWidth || 120, h: el.offsetHeight || 46,
            kx: 0, ky: 0, dead: false, isPlayer
        }, def, extra || {});
        f.maxHp = def.hp;
        f.hp = def.hp;
        place(f);
        return f;
    }

    function edgeSpawn(w, h) {
        const W = arenaW(), H = arenaH();
        let x = 0, y = TOP;
        for (let i = 0; i < 12; i++) {
            const side = Math.floor(Math.random() * 4);
            if (side === 0) { x = 0; y = TOP + Math.random() * Math.max(1, H - TOP - h); }
            else if (side === 1) { x = W - w; y = TOP + Math.random() * Math.max(1, H - TOP - h); }
            else if (side === 2) { y = TOP; x = Math.random() * Math.max(1, W - w); }
            else { y = H - h; x = Math.random() * Math.max(1, W - w); }
            if (!S.player || Math.hypot(x - S.player.x, y - S.player.y) > 300) break;
        }
        return { x, y };
    }

    // ---------------- waves ----------------
    function scaledStats(base, wave) {
        const hpM = 1 + 0.12 * (wave - 1);
        const dmgM = 1 + 0.07 * (wave - 1);
        const spdM = Math.min(1.35, 1 + 0.02 * (wave - 1));
        return {
            hp: Math.round(base.hp * hpM),
            dmg: base.dmg * dmgM * ENEMY_DMG_FACTOR,
            speed: base.speed * ENEMY_SPEED_FACTOR * spdM,
            cd: ENEMY_CD
        };
    }

    function bonusDef(k, wave) {
        // k = 1..10 : later bonus buttons are tougher and meaner
        const base = { hp: 90 + 28 * k, dmg: 9 + 2.4 * k, speed: 2.6 + 0.12 * k };
        const st = scaledStats(base, wave);
        st.cd = Math.max(600, ENEMY_CD - k * 40);
        return Object.assign({ id: 'bonus' + k, name: BONUS[k - 1], weapon: BONUS_WEAPONS[k - 1] }, st);
    }

    function startWave(n) {
        S.wave = n;
        S.transition = false;
        if (n > getBestWave()) setBestWave(n);

        const defs = CHARS.filter(c => c.id !== S.charId)
            .map(c => Object.assign({ id: c.id, name: c.name, weapon: c.weapon }, scaledStats(c, n)));
        let newest = null;
        if (n >= BONUS_START_WAVE) {
            const count = Math.min(BONUS.length, n - BONUS_START_WAVE + 1);
            for (let k = 1; k <= count; k++) defs.push(bonusDef(k, n));
            if (n - BONUS_START_WAVE + 1 <= BONUS.length) newest = BONUS[n - BONUS_START_WAVE];
        }

        const now = performance.now();
        S.enemies = defs.map((d, i) => {
            const probe = { x: 0, y: 0 };
            const f = createFighter(d, false, probe.x, probe.y, {
                reach: ENEMY_REACH, nextAttack: 0, winding: false, hitAt: 0, activeAt: now + 900 + i * 120
            });
            const p = edgeSpawn(f.w, f.h);
            f.x = p.x; f.y = p.y; place(f);
            f.el.classList.add('spawning');
            later(() => f.el.classList.remove('spawning'), 700 + i * 120);
            return f;
        });

        banner(newest ? `WAVE ${n}\nNEW: ${newest.toUpperCase()}` : `WAVE ${n}`, 1800);
        beep(330, 0.1); later(() => beep(494, 0.14), 100);
        updateHud();
    }

    function waveCleared() {
        if (S.transition || S.ended) return;
        S.transition = true;
        const heal = Math.round(S.player.maxHp * WAVE_HEAL);
        S.player.hp = Math.min(S.player.maxHp, S.player.hp + heal);
        setBar(S.player);
        updateHud();
        banner(`WAVE ${S.wave} CLEARED\n+${heal} HP`, 1800);
        [523, 659, 784].forEach((f, i) => later(() => beep(f, 0.14, 'triangle', 0.07), i * 100));
        later(() => { if (!S.ended && S.open) startWave(S.wave + 1); }, 2200);
    }

    // ---------------- combat ----------------
    function gap(a, b) {
        const dx = Math.max(0, Math.abs((a.x + a.w / 2) - (b.x + b.w / 2)) - (a.w + b.w) / 2);
        const dy = Math.max(0, Math.abs((a.y + a.h / 2) - (b.y + b.h / 2)) - (a.h + b.h) / 2);
        return Math.hypot(dx, dy);
    }

    function popup(target, amount, cls) {
        const p = document.createElement('div');
        p.className = 'f-pop ' + cls;
        p.textContent = '-' + amount;
        p.style.left = (target.x + target.w / 2 - 10 + (Math.random() - 0.5) * 30) + 'px';
        p.style.top = (target.y - 10) + 'px';
        arenaEl.appendChild(p);
        later(() => p.remove(), 720);
    }

    function hurt(target, raw) {
        const amount = Math.max(1, Math.round(raw));
        target.hp -= amount;
        setBar(target);
        target.el.classList.remove('hit');
        void target.el.offsetWidth;
        target.el.classList.add('hit');
        popup(target, amount, target.isPlayer ? 'to-player' : 'to-enemy');
        if (target.isPlayer) {
            overlay.classList.remove('hurt'); void overlay.offsetWidth; overlay.classList.add('hurt');
            beep(150, 0.15, 'sawtooth', 0.07);
            updateHud();
        } else {
            beep(300, 0.07);
        }
        if (target.hp <= 0) kill(target);
    }

    function kill(f) {
        if (f.dead) return;
        f.dead = true;
        f.el.classList.add('dying');
        later(() => f.el.remove(), 350);
        if (f.isPlayer) {
            gameOver();
        } else {
            beep(110, 0.25, 'sawtooth', 0.07);
            updateHud();
            if (!S.enemies.some(e => !e.dead)) waveCleared();
        }
    }

    function playerAttack(t) {
        const p = S.player;
        p.nextAttack = t + PLAYER_ATK_CD;

        const ring = document.createElement('div');
        ring.className = 'f-ring';
        ring.style.left = (p.x - PLAYER_ATK_RANGE) + 'px';
        ring.style.top = (p.y - PLAYER_ATK_RANGE) + 'px';
        ring.style.width = (p.w + PLAYER_ATK_RANGE * 2) + 'px';
        ring.style.height = (p.h + PLAYER_ATK_RANGE * 2) + 'px';
        ring.style.borderRadius = PLAYER_ATK_RANGE + 'px';
        arenaEl.appendChild(ring);
        later(() => ring.remove(), 260);
        beep(520, 0.05, 'triangle', 0.04);

        const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
        S.enemies.forEach(e => {
            if (e.dead || gap(p, e) > PLAYER_ATK_RANGE) return;
            const dx = (e.x + e.w / 2) - pcx, dy = (e.y + e.h / 2) - pcy;
            const d = Math.hypot(dx, dy) || 1;
            const kb = 7 + p.dmg * 0.4;
            e.kx = dx / d * kb; e.ky = dy / d * kb;
            hurt(e, p.dmg * (0.9 + Math.random() * 0.2));
        });
    }

    function enemyHitsPlayer(e, t) {
        const p = S.player;
        if (!p || p.dead || t < p.iUntil) return;
        p.iUntil = t + PLAYER_IFRAMES;
        hurt(p, e.dmg * (0.9 + Math.random() * 0.2));
    }

    function gameOver() {
        S.ended = true;
        S.mouse.down = false;
        stopLoop();
        const best = Math.max(getBestWave(), S.wave);
        setBestWave(best);
        overText.textContent = `reached wave ${S.wave}  ·  best wave: ${best}`;
        beep(130, 0.5, 'sawtooth', 0.09);
        later(() => overEl.classList.remove('is-hidden'), 600);
    }

    // ---------------- HUD ----------------
    function updateHud() {
        const p = S.player;
        if (p) {
            const hp = Math.max(0, Math.ceil(p.hp));
            hudFill.style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
            hudText.textContent = `${hp} / ${p.maxHp}`;
        }
        hudWave.textContent = 'WAVE ' + S.wave;
        const left = S.enemies.filter(e => !e.dead).length;
        hudLeft.textContent = left + 'LEFT';
    }

    let bannerTimer = null;
    function banner(text, ms) {
        bannerEl.textContent = text;
        bannerEl.classList.add('show');
        clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => bannerEl.classList.remove('show'), ms);
    }

    // ---------------- game start / loop ----------------
    function startGame(charId) {
        const c = CHARS.find(x => x.id === charId);
        if (!c) return;
        stopLoop();
        clearLater();
        arenaEl.innerHTML = '';
        S.charId = charId;
        S.ended = false;
        S.transition = false;
        S.enemies = [];
        S.wave = 0;

        selectEl.classList.add('is-hidden');
        overEl.classList.add('is-hidden');
        playEl.classList.remove('is-hidden');

        const W = arenaW(), H = arenaH();
        S.mouse.x = W / 2; S.mouse.y = H / 2; S.mouse.down = false;

        S.player = createFighter({ id: c.id, name: c.name, hp: c.hp, speed: c.speed, dmg: c.dmg, weapon: c.weapon },
            true, 0, 0, { nextAttack: 0, iUntil: 0 });
        S.player.x = (W - S.player.w) / 2;
        S.player.y = (H - S.player.h) / 2 + 40;
        place(S.player);

        hudName.textContent = c.name;
        hudName.style.color = c.color;
        startWave(1);
        updateHud();

        S.running = true;
        S.last = performance.now();
        S.raf = requestAnimationFrame(tick);
    }

    function stopLoop() {
        S.running = false;
        if (S.raf) cancelAnimationFrame(S.raf);
        S.raf = 0;
    }

    function separate(a, b) {
        const dx = (b.x + b.w / 2) - (a.x + a.w / 2);
        const dy = (b.y + b.h / 2) - (a.y + a.h / 2);
        const ox = (a.w + b.w) / 2 - Math.abs(dx);
        const oy = (a.h + b.h) / 2 - Math.abs(dy);
        if (ox <= 0 || oy <= 0) return;
        const wa = a.isPlayer ? 0 : (b.isPlayer ? 1 : 0.5);
        const wb = b.isPlayer ? 0 : (a.isPlayer ? 1 : 0.5);
        if (ox < oy) { const s = dx >= 0 ? 1 : -1; a.x -= s * ox * wa; b.x += s * ox * wb; }
        else         { const s = dy >= 0 ? 1 : -1; a.y -= s * oy * wa; b.y += s * oy * wb; }
    }

    function clampToArena(f, W, H) {
        f.x = Math.max(0, Math.min(W - f.w, f.x));
        f.y = Math.max(TOP, Math.min(H - f.h, f.y));
    }

    function tick(t) {
        if (!S.running) return;
        const dt = Math.min(50, t - S.last);
        S.last = t;
        const f = dt / 16.667;
        const W = arenaW(), H = arenaH();
        const p = S.player;

        // --- player: glide toward the cursor at its speed stat
        const dx = S.mouse.x - (p.x + p.w / 2);
        const dy = S.mouse.y - (p.y + p.h / 2);
        const d = Math.hypot(dx, dy);
        if (d > 4) {
            const step = Math.min(d, p.speed * 1.15 * f);
            p.x += dx / d * step;
            p.y += dy / d * step;
        }
        if (S.mouse.down && t >= p.nextAttack && !S.transition) playerAttack(t);

        // --- enemies
        S.enemies.forEach(e => {
            if (e.dead) return;
            const g = gap(e, p);
            if (t >= e.activeAt) {
                if (g > 2) {
                    const ex = (p.x + p.w / 2) - (e.x + e.w / 2);
                    const ey = (p.y + p.h / 2) - (e.y + e.h / 2);
                    const ed = Math.hypot(ex, ey) || 1;
                    e.x += ex / ed * e.speed * f;
                    e.y += ey / ed * e.speed * f;
                }
                if (!e.winding && g <= e.reach && t >= e.nextAttack && !S.transition) {
                    e.winding = true;
                    e.hitAt = t + ENEMY_WINDUP;
                    e.weaponEl.classList.remove('swing'); void e.weaponEl.offsetWidth;
                    e.weaponEl.classList.add('swing');
                } else if (e.winding && t >= e.hitAt) {
                    e.winding = false;
                    e.nextAttack = t + e.cd;
                    if (gap(e, p) <= e.reach + 16) enemyHitsPlayer(e, t);
                }
            }
            // knockback
            e.x += e.kx * f; e.y += e.ky * f;
            const decay = Math.pow(0.86, f);
            e.kx *= decay; e.ky *= decay;
        });

        // --- keep everybody apart and inside the arena
        const alive = S.enemies.filter(e => !e.dead);
        for (let i = 0; i < alive.length; i++) {
            separate(alive[i], p);
            for (let j = i + 1; j < alive.length; j++) separate(alive[i], alive[j]);
        }
        clampToArena(p, W, H);
        alive.forEach(e => clampToArena(e, W, H));
        place(p);
        alive.forEach(place);

        if (S.running) S.raf = requestAnimationFrame(tick);
    }
})();