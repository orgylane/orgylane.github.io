const menuToggle = document.querySelector('.menu-toggle');
const navBar = document.querySelector('.nav-bar');

if (menuToggle && navBar) {
    menuToggle.addEventListener('click', () => {
        const isOpen = navBar.classList.toggle('open');
        menuToggle.setAttribute('aria-expanded', String(isOpen));
    });
}

// ==========================================================================
// MODALS MANAGEMENT (COMIC & ALBUM)
// ==========================================================================
 
const epModal = document.getElementById('ep-modal');
const epModalClose = document.getElementById('ep-modal-close');
const epSideRight = document.getElementById('ep-side-right');
 
const epSaveModal = document.getElementById('ep-save-modal');
const epSaveModalClose = document.getElementById('ep-save-modal-close');
const epSideLeft = document.getElementById('ep-side-left');
 
function openEpModal() {
    if (!epModal) return;
    epModal.classList.add('open');
}
 
function closeEpModal() {
    if (!epModal) return;
    epModal.classList.remove('open');
}
 
function openEpSaveModal() {
    if (!epSaveModal) return;
    epSaveModal.classList.add('open');
}
 
function closeEpSaveModal() {
    if (!epSaveModal) return;
    epSaveModal.classList.remove('open');
}
 
if (epModalClose) {
    epModalClose.addEventListener('click', closeEpModal);
}
 
if (epModal) {
    epModal.addEventListener('click', (e) => {
        if (e.target === epModal) closeEpModal();
    });
}
 
if (epSideRight) {
    epSideRight.addEventListener('click', openEpModal);
}
 
if (epSaveModalClose) {
    epSaveModalClose.addEventListener('click', closeEpSaveModal);
}
 
if (epSaveModal) {
    epSaveModal.addEventListener('click', (e) => {
        if (e.target === epSaveModal) closeEpSaveModal();
    });
}
 
if (epSideLeft) {
    epSideLeft.addEventListener('click', openEpSaveModal);
}
 
// ---- scroll parallax: left image drifts down, right image drifts up ----
const EP_PARALLAX_MAX = 400; // px, how far each image can drift
const EP_PARALLAX_SPEED = 0.35; // higher = drifts faster per pixel scrolled
 
function updateEpParallax() {
    const offset = Math.min(window.scrollY * EP_PARALLAX_SPEED, EP_PARALLAX_MAX);
    if (epSideLeft) {
        epSideLeft.style.transform = `translateY(${offset}px)`;
    }
    if (epSideRight) {
        epSideRight.style.transform = `translateY(${-offset}px)`;
    }
}
 
window.addEventListener('scroll', updateEpParallax, { passive: true });
updateEpParallax();

// ==========================================================================
// LIGHTWEIGHT GALLERY IMAGE ZOOM (NO EXTRA HTML NEEDED)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const images = document.querySelectorAll('.gallery-cd-img');
    if (!images.length) return;

    // Overlay létrehozása dinamikusan
    const overlay = document.createElement('div');
    overlay.className = 'photo-overlay';
    overlay.innerHTML = `
        <div class="photo-panel">
            <button type="button" class="photo-close" aria-label="Close">&times;</button>
            <img id="zoom-img-target" src="" alt="">
        </div>
    `;
    document.body.appendChild(overlay);

    const targetImg = overlay.querySelector('#zoom-img-target');
    const closeBtn = overlay.querySelector('.photo-close');

    const closeZoom = () => overlay.classList.remove('open');

    images.forEach(img => {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', () => {
            targetImg.src = img.src;
            targetImg.alt = img.alt;
            overlay.classList.add('open');
        });
    });

    closeBtn.addEventListener('click', closeZoom);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeZoom();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeZoom();
    });
});


// ==========================================================================
// TEASBOGRE COMICS - BUBBLE MENU + BATTLE GAME
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const comicModal = document.getElementById('comics-modal');
    const comicsBtn = document.getElementById('comics-side-btn');
    const closeBtn = document.getElementById('comics-modal-close');
    if (!comicModal) return;

    const views = comicModal.querySelectorAll('.comics-view');
    const bubbleBtns = comicModal.querySelectorAll('.comic-bubble');
    const backBtns = comicModal.querySelectorAll('.comic-back-btn');
    const stage = document.getElementById('floating-bubbles-stage');
    const hud = document.getElementById('bubble-game-hud');
    const timerEl = document.getElementById('game-timer');
    const bestTimerEl = document.getElementById('game-best-time');
    const menuBestEl = document.getElementById('menu-best-time');
    const resetBestBtn = document.getElementById('reset-best-btn');
    const banner = document.getElementById('game-message-banner');
    const canvas = document.getElementById('game-fx-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    if (!stage) return;

    // ---- tuning ----
    const HOLD_MS = 200;        // hold time to grab a bubble
    const MAX_HP = 10;
    const HIT_COOLDOWN = 250;   // ms between hits on the same target
    const MIN_HIT_SPEED = 1.5;  // slower bumps do no damage
    const BIG_HIT_SPEED = 6;    // faster than this = 2 hearts
    const MAX_SPEED = 9;        // hard cap so nothing becomes a missile
    const IDLE_SPEED = 0.35;    // normal drifting speed
    const TOP_PAD = 26;         // room above bubbles for the hearts
    const STORAGE_KEY = 'teasbogre_bubble_best';

    // ---- state ----
    let gameActive = false;     // a match is running
    let battleLocked = false;   // true from grab until the bubbles are reset (menu locked)
    let suppressClickUntil = 0;
    let gameStartTime = 0;
    let timerInterval = null;
    let resetTimeout = null;
    let bannerTimeout = null;
    let activePlayerBubble = null;
    let laidOut = false;
    let particles = [];
    let confetti = [];
    let audioCtx = null;

    // ---- best score: localStorage with cookie fallback ----
    function getBestScore() {
        try {
            const v = localStorage.getItem(STORAGE_KEY);
            if (v) return v;
        } catch (e) {}
        const m = document.cookie.match(new RegExp('(?:^|; )' + STORAGE_KEY + '=(\\d+)'));
        return m ? m[1] : null;
    }
    function saveBestScore(ms) {
        try { localStorage.setItem(STORAGE_KEY, String(ms)); } catch (e) {}
        document.cookie = `${STORAGE_KEY}=${ms}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
    }
    function formatTime(ms) {
        const m = Math.floor(ms / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        const milli = Math.floor(ms % 1000);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
    }
    // ---- FIGHT! unlock: needs 3 finished hold-fight games ----
    const GAMES_KEY = 'teasbogre_holdgames';
    const GAMES_TO_UNLOCK = 3;
    // FIGHT! only exists after Halloween: Nov 1st 2026, 00:00 in the visitor's local time (month 10 = November)
    const FIGHT_OPEN_DATE = new Date(2026, 10, 1);
    // owner testing shortcut: add ?fight=1 to the page URL to skip the date check (delete this to remove it)
    const fightDateOk = () =>
        new Date() >= FIGHT_OPEN_DATE || new URLSearchParams(location.search).has('fight');
    let afterResetBanner = null;

    // easter egg: the tip / teaser text stays hidden until a bubble has been held once
    const SEEN_KEY = 'teasbogre_hold_seen';
    function holdEverSeen() {
        try { if (localStorage.getItem(SEEN_KEY)) return true; } catch (e) {}
        return document.cookie.indexOf(SEEN_KEY + '=1') !== -1;
    }
    function markHoldSeen() {
        if (holdEverSeen()) return;
        try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
        document.cookie = `${SEEN_KEY}=1; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
        updateFightUnlock();
    }
    function getGamesPlayed() {
        try { const v = localStorage.getItem(GAMES_KEY); if (v) return parseInt(v, 10) || 0; } catch (e) {}
        const m = document.cookie.match(new RegExp('(?:^|; )' + GAMES_KEY + '=(\\d+)'));
        return m ? parseInt(m[1], 10) : 0;
    }
    function setGamesPlayed(n) {
        try { localStorage.setItem(GAMES_KEY, String(n)); } catch (e) {}
        document.cookie = `${GAMES_KEY}=${n}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
    }
    function updateFightUnlock() {
        const n = getGamesPlayed();
        const unlocked = n >= GAMES_TO_UNLOCK && fightDateOk();
        const fightBtn = document.getElementById('fight-start-btn');
        const hint = document.getElementById('menu-hint');
        if (fightBtn) fightBtn.classList.toggle('is-locked', !unlocked);
        const bestRow = document.getElementById('best-row');
        if (bestRow) {
            const seenRow = holdEverSeen();
            bestRow.classList.toggle('egg-hidden', !seenRow);
            bestRow.setAttribute('aria-hidden', seenRow ? 'false' : 'true');
        }
        if (hint) {
            const seen = holdEverSeen();
            hint.classList.toggle('egg-hidden', !seen);
            hint.setAttribute('aria-hidden', seen ? 'false' : 'true');
            if (!seen) {
                hint.textContent = '';
            } else if (!fightDateOk()) {
                hint.textContent = 'tip: hold any bubble to grab it & duel  ·  something new arrives after Halloween 🎃';
            } else if (!unlocked) {
                hint.textContent = `tip: hold any bubble to grab it & duel (${GAMES_TO_UNLOCK - n} more to unlock FIGHT!)`;
            } else {
                hint.textContent = 'tip: hold any bubble to grab it & duel';
            }
        }
    }
    function countFinishedGame() {
        const before = getGamesPlayed();
        setGamesPlayed(before + 1);
        if (before < GAMES_TO_UNLOCK && before + 1 >= GAMES_TO_UNLOCK) {
            afterResetBanner = fightDateOk()
                ? '⚔️ FIGHT! MODE UNLOCKED!'
                : '🎃 FIGHT! MODE ARRIVES AFTER HALLOWEEN...';
        }
        updateFightUnlock();
    }
    updateFightUnlock();

    function clearBestScore() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        document.cookie = `${STORAGE_KEY}=; max-age=0; path=/`;
    }
    function updateBestScoreDisplay() {
        const best = getBestScore();
        const text = best ? formatTime(parseInt(best, 10)) : '--:--.---';
        if (bestTimerEl) bestTimerEl.textContent = text;
        if (menuBestEl) menuBestEl.textContent = text;
    }

    // reset best time (click twice to confirm)
    let resetConfirmTimer = null;
    if (resetBestBtn) {
        resetBestBtn.addEventListener('click', () => {
            if (battleLocked) return;
            if (!resetBestBtn.classList.contains('confirming')) {
                resetBestBtn.classList.add('confirming');
                resetBestBtn.textContent = 'SURE?';
                clearTimeout(resetConfirmTimer);
                resetConfirmTimer = setTimeout(() => {
                    resetBestBtn.classList.remove('confirming');
                    resetBestBtn.textContent = 'RESET';
                }, 2500);
                return;
            }
            clearTimeout(resetConfirmTimer);
            resetBestBtn.classList.remove('confirming');
            resetBestBtn.textContent = 'RESET';
            clearBestScore();
            updateBestScoreDisplay();
        });
    }

    // ---- sound ----
    function beep(freq, dur, type = 'square', vol = 0.06) {
        try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = type;
            o.frequency.value = freq;
            g.gain.setValueAtTime(vol, audioCtx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
            o.connect(g).connect(audioCtx.destination);
            o.start();
            o.stop(audioCtx.currentTime + dur);
        } catch (e) {}
    }

    // ---- banner ----
    function showBanner(text, type, duration = 3500) {
        if (!banner) return;
        clearTimeout(bannerTimeout);
        banner.textContent = text;
        banner.className = `game-message-banner show ${type}`;
        bannerTimeout = setTimeout(() => banner.classList.remove('show'), duration);
    }

    // ---- bubbles ----
    const bubblesData = Array.from(bubbleBtns).map(btn => ({
        element: btn,
        hpBar: btn.querySelector('.bubble-hp-bar'),
        x: 0, y: 0,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        width: 160, height: 60,
        hp: MAX_HP,
        isHeld: false,
        isDestroyed: false,
        holdTimer: null,
        lastHit: 0,
        dragVx: 0, dragVy: 0
    }));

    function measure() {
        bubblesData.forEach(b => {
            b.width = b.element.offsetWidth || b.width;
            b.height = b.element.offsetHeight || b.height;
        });
    }

    // Spread bubbles out the first time the stage is actually visible
    function layoutBubbles() {
        const W = stage.clientWidth, H = stage.clientHeight;
        if (!W || !H) return;
        measure();
        const n = bubblesData.length;
        bubblesData.forEach((b, i) => {
            const slotW = W / n;
            b.x = Math.min(W - b.width, Math.max(0, slotW * i + (slotW - b.width) / 2));
            b.y = TOP_PAD + Math.random() * Math.max(0, H - TOP_PAD - b.height);
        });
        laidOut = true;
    }

    function resizeCanvas() {
        if (!canvas) return;
        if (canvas.width !== stage.clientWidth || canvas.height !== stage.clientHeight) {
            canvas.width = stage.clientWidth;
            canvas.height = stage.clientHeight;
        }
    }
    window.addEventListener('resize', () => { resizeCanvas(); measure(); });

    function updateHpDisplay(b) {
        if (!b.hpBar) return;
        const hp = Math.max(0, b.hp);
        b.hpBar.textContent = '❤️'.repeat(hp) + '🖤'.repeat(MAX_HP - hp);
    }

    function clampSpeed(b, max) {
        const s = Math.hypot(b.vx, b.vy);
        if (s > max) { b.vx = b.vx / s * max; b.vy = b.vy / s * max; }
    }

    // ---- modal open / close ----
    function openModal() {
        comicModal.classList.add('open');
        comicModal.setAttribute('aria-hidden', 'false');
        updateBestScoreDisplay();
        requestAnimationFrame(() => {
            resizeCanvas();
            if (!laidOut) layoutBubbles(); else measure();
        });
    }

    function closeModal() {
        comicModal.classList.remove('open');
        comicModal.setAttribute('aria-hidden', 'true');
        endGame('quiet');
        resetBubbles();
        particles = [];
        confetti = [];
        if (banner) banner.classList.remove('show');
        setTimeout(() => switchView('comics-main-view'), 300);
    }

    if (comicsBtn) comicsBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
    comicModal.addEventListener('click', (e) => { if (e.target === comicModal) closeModal(); });
    document.addEventListener('keydown', (e) => {
        const fightOpen = document.getElementById('fight-overlay');
        if (fightOpen && fightOpen.classList.contains('open')) return;
        if (e.key === 'Escape' && comicModal.classList.contains('open')) closeModal();
    });

    // ---- grabbing ----
    bubblesData.forEach(data => {
        const btn = data.element;

        btn.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (battleLocked || data.isDestroyed) return;
            clearTimeout(data.holdTimer);

            data.holdTimer = setTimeout(() => {
                if (e.pointerType === 'touch' || e.pointerType === 'pen') {
                    suppressClickUntil = Date.now() + 400;
                    showBanner('BATTLE MODE IS UNFORTUNATELY NOT AVAILABLE ON MOBILE YET! 📱', 'mobile-warn', 3000);
                } else {
                    startGrabGame(data);
                }
            }, HOLD_MS);
        });

        const cancelHold = () => clearTimeout(data.holdTimer);
        btn.addEventListener('pointerup', cancelHold);
        btn.addEventListener('pointercancel', cancelHold);
        btn.addEventListener('pointerleave', cancelHold);
        btn.addEventListener('dragstart', e => e.preventDefault());
    });

    function startGrabGame(playerData) {
        if (battleLocked) return;
        battleLocked = true;
        gameActive = true;
        markHoldSeen();
        activePlayerBubble = playerData;
        playerData.isHeld = true;
        playerData.dragVx = playerData.dragVy = 0;
        stage.classList.add('battle-on');
        comicModal.classList.add('battle-dark');
        if (resetBestBtn) resetBestBtn.disabled = true;
        playerData.element.classList.add('held-weapon');
        measure();

        bubblesData.forEach(b => {
            if (b !== playerData) {
                b.hp = MAX_HP;
                b.isDestroyed = false;
                b.lastHit = 0;
                b.element.classList.remove('destroyed');
                b.element.classList.add('target-enemy');
                updateHpDisplay(b);
            }
        });
        // hearts appear above the enemies -> re-measure after they're shown
        requestAnimationFrame(measure);

        if (hud) hud.style.display = 'flex';
        if (timerEl) timerEl.textContent = formatTime(0);
        gameStartTime = Date.now();
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (timerEl) timerEl.textContent = formatTime(Date.now() - gameStartTime);
        }, 30);

        showBanner('BATTLE STARTED! DESTROY THE OTHERS!', 'victory', 2000);
        beep(440, 0.12, 'square'); setTimeout(() => beep(660, 0.15, 'square'), 110);

        const onMove = (e) => {
            if (!playerData.isHeld) return;
            const rect = stage.getBoundingClientRect();
            const tx = Math.max(0, Math.min(stage.clientWidth - playerData.width,
                e.clientX - rect.left - playerData.width / 2));
            const ty = Math.max(TOP_PAD, Math.min(stage.clientHeight - playerData.height,
                e.clientY - rect.top - playerData.height / 2));
            playerData.dragVx = tx - playerData.x;
            playerData.dragVy = ty - playerData.y;
            playerData.x = tx;
            playerData.y = ty;
        };

        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            // the click that follows this release must not open a menu page
            suppressClickUntil = Date.now() + 400;
            if (gameActive && playerData.isHeld) endGame('dropped');
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    }

    // ---- end of game ----
    function endGame(result) {
        const wasPlaying = gameActive;
        // a win only counts while the bubble is still in your hand; otherwise it's a drop
        if (result === 'victory' && !(activePlayerBubble && activePlayerBubble.isHeld)) result = 'dropped';
        gameActive = false;
        clearInterval(timerInterval);

        const player = activePlayerBubble;
        activePlayerBubble = null;
        if (player) {
            player.isHeld = false;
            player.vx = player.vy = 0;
            player.element.classList.remove('held-weapon');
        }
        if (!wasPlaying) return;

        clearTimeout(resetTimeout);
        if (result === 'dropped' || result === 'victory') countFinishedGame();

        if (result === 'dropped') {
            if (player) {
                player.isDestroyed = true;
                player.element.classList.add('destroyed');
                spawnSparks(player.x + player.width / 2, player.y + player.height / 2, '#ff0033', 30);
            }
            beep(160, 0.4, 'sawtooth', 0.08);
            showBanner('YOU DROPPED YOUR BUTTON... IT DIED. GAME OVER! 💀', 'game-over', 3500);
            resetTimeout = setTimeout(resetBubbles, 2500);
        } else if (result === 'victory') {
            const finalMs = Date.now() - gameStartTime;
            if (timerEl) timerEl.textContent = formatTime(finalMs);
            const best = getBestScore();
            const isNewBest = finalMs > 0 && (!best || finalMs < parseInt(best, 10));
            if (isNewBest) { saveBestScore(finalMs); updateBestScoreDisplay(); }

            showBanner(`VICTORY! TIME: ${formatTime(finalMs)}${isNewBest ? ' ⭐ NEW BEST TIME!' : ''}`, 'victory', 3500);
            triggerConfetti();
            [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'triangle', 0.08), i * 110));
            resetTimeout = setTimeout(resetBubbles, 3000);
        }
    }

    // Back to menu mode: unlock clicks, calm speeds, bring everything back
    function resetBubbles() {
        clearTimeout(resetTimeout);
        battleLocked = false;
        gameActive = false;
        stage.classList.remove('battle-on');
        comicModal.classList.remove('battle-dark');
        if (resetBestBtn) resetBestBtn.disabled = false;
        if (hud) hud.style.display = 'none';
        bubblesData.forEach(b => {
            b.isDestroyed = false;
            b.isHeld = false;
            b.hp = MAX_HP;
            b.vx = (Math.random() - 0.5) * 0.7;
            b.vy = (Math.random() - 0.5) * 0.7;
            b.element.classList.remove('destroyed', 'target-enemy', 'held-weapon', 'hit');
            clearTimeout(b.holdTimer);
        });
        measure();
        if (afterResetBanner) {
            showBanner(afterResetBanner, 'victory', 3500);
            afterResetBanner = null;
        }
    }

    // ---- effects ----
    function spawnSparks(x, y, color, count = 12) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 7,
                vy: (Math.random() - 0.5) * 7,
                size: Math.random() * 3 + 2,
                color,
                life: 24, maxLife: 24
            });
        }
    }

    function triggerConfetti() {
        if (!canvas) return;
        resizeCanvas();
        const colors = ['#00ff00', '#ff00ff', '#ffffff', '#ffcc00', '#00ccff', '#ff0055'];
        for (let i = 0; i < 160; i++) {
            confetti.push({
                x: canvas.width / 2,
                y: canvas.height * 0.55,
                vx: (Math.random() - 0.5) * 16,
                vy: -Math.random() * 14 - 3,
                size: Math.random() * 6 + 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 140, maxLife: 140
            });
        }
    }

    // ---- collisions (always on; damage only during a match) ----
    function resolveCollision(b1, b2, now) {
        if (b1.isDestroyed || b2.isDestroyed) return;

        const dx = (b2.x + b2.width / 2) - (b1.x + b1.width / 2);
        const dy = (b2.y + b2.height / 2) - (b1.y + b1.height / 2);
        const overlapX = (b1.width + b2.width) / 2 - Math.abs(dx);
        const overlapY = (b1.height + b2.height) / 2 - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) return;

        // separate along the axis of least penetration
        let nx = 0, ny = 0, push;
        if (overlapX < overlapY) { nx = dx >= 0 ? 1 : -1; push = overlapX; }
        else { ny = dy >= 0 ? 1 : -1; push = overlapY; }

        // a held bubble can't be pushed; otherwise split evenly
        const w1 = b1.isHeld ? 0 : (b2.isHeld ? 1 : 0.5);
        const w2 = b2.isHeld ? 0 : (b1.isHeld ? 1 : 0.5);
        b1.x -= nx * push * w1; b1.y -= ny * push * w1;
        b2.x += nx * push * w2; b2.y += ny * push * w2;

        // velocities (a held bubble moves at the mouse's speed)
        const v1x = b1.isHeld ? b1.dragVx : b1.vx, v1y = b1.isHeld ? b1.dragVy : b1.vy;
        const v2x = b2.isHeld ? b2.dragVx : b2.vx, v2y = b2.isHeld ? b2.dragVy : b2.vy;
        const rvx = v2x - v1x, rvy = v2y - v1y;
        const impactSpeed = Math.hypot(rvx, rvy);
        const velAlongNormal = rvx * nx + rvy * ny;

        if (velAlongNormal < 0 || (b1.isHeld || b2.isHeld)) {
            const e = 0.85;
            const j = Math.min(Math.abs(velAlongNormal) * (1 + e), MAX_SPEED);
            if (b1.isHeld) {
                b2.vx += nx * j; b2.vy += ny * j;
            } else if (b2.isHeld) {
                b1.vx -= nx * j; b1.vy -= ny * j;
            } else if (velAlongNormal < 0) {
                b1.vx -= nx * j * 0.5; b1.vy -= ny * j * 0.5;
                b2.vx += nx * j * 0.5; b2.vy += ny * j * 0.5;
            }
            clampSpeed(b1, MAX_SPEED);
            clampSpeed(b2, MAX_SPEED);
        }

        // damage: only in a match, only when the held bubble hits a target
        if (gameActive && (b1.isHeld || b2.isHeld)) {
            const target = b1.isHeld ? b2 : b1;
            if (!target.element.classList.contains('target-enemy')) return;
            if (impactSpeed < MIN_HIT_SPEED || now - target.lastHit < HIT_COOLDOWN) return;

            target.lastHit = now;
            target.hp -= impactSpeed > BIG_HIT_SPEED ? 2 : 1;
            updateHpDisplay(target);

            target.element.classList.remove('hit');
            void target.element.offsetWidth; // restart the flash animation
            target.element.classList.add('hit');

            const cx = (b1.x + b1.width / 2 + b2.x + b2.width / 2) / 2;
            const cy = (b1.y + b1.height / 2 + b2.y + b2.height / 2) / 2;
            spawnSparks(cx, cy, '#ff0055');
            beep(impactSpeed > BIG_HIT_SPEED ? 220 : 320, 0.09, 'square');

            if (target.hp <= 0) {
                target.isDestroyed = true;
                target.element.classList.add('destroyed');
                spawnSparks(target.x + target.width / 2, target.y + target.height / 2, '#ffffff', 28);
                beep(110, 0.3, 'sawtooth', 0.08);
                if (gameActive && activePlayerBubble && !activePlayerBubble.isDestroyed &&
                    !bubblesData.some(b => b !== activePlayerBubble && !b.isDestroyed)) endGame('victory');
            }
        }
    }

    // ---- main loop ----
    function physicsLoop() {
        const open = comicModal.classList.contains('open');
        const W = stage.clientWidth, H = stage.clientHeight;

        // stage is 0-size while a sub-view is showing: skip so nothing gets squashed into a corner
        if (open && W > 0 && H > 0) {
            if (!laidOut) layoutBubbles();
            resizeCanvas();
            const now = Date.now();

            bubblesData.forEach(b => {
                if (b.isHeld || b.isDestroyed) return;
                // gentle damping of fast bubbles, nudge slow ones so the menu keeps drifting
                const s = Math.hypot(b.vx, b.vy);
                if (s > IDLE_SPEED * 1.5) { b.vx *= 0.992; b.vy *= 0.992; }
                else if (s < 0.08) { b.vx += (Math.random() - 0.5) * 0.2; b.vy += (Math.random() - 0.5) * 0.2; }

                b.x += b.vx;
                b.y += b.vy;
                if (b.x <= 0) { b.x = 0; b.vx = Math.abs(b.vx); }
                if (b.x + b.width >= W) { b.x = W - b.width; b.vx = -Math.abs(b.vx); }
                if (b.y <= TOP_PAD) { b.y = TOP_PAD; b.vy = Math.abs(b.vy); }
                if (b.y + b.height >= H) { b.y = H - b.height; b.vy = -Math.abs(b.vy); }
            });

            // held bubble: its "mouse speed" fades if the mouse stops
            bubblesData.forEach(b => { if (b.isHeld) { b.dragVx *= 0.7; b.dragVy *= 0.7; } });

            for (let i = 0; i < bubblesData.length; i++) {
                for (let j = i + 1; j < bubblesData.length; j++) {
                    resolveCollision(bubblesData[i], bubblesData[j], now);
                }
            }

            // keep everything inside the stage after collision pushes
            bubblesData.forEach(b => {
                b.x = Math.max(0, Math.min(W - b.width, b.x));
                b.y = Math.max(TOP_PAD, Math.min(H - b.height, b.y));
                b.element.style.left = `${b.x}px`;
                b.element.style.top = `${b.y}px`;
            });

            // fx canvas
            if (ctx && canvas) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                for (const p of particles) {
                    p.x += p.vx; p.y += p.vy; p.life--;
                    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                }
                particles = particles.filter(p => p.life > 0);

                for (const c of confetti) {
                    c.vy += 0.25; c.vx *= 0.99;
                    c.x += c.vx; c.y += c.vy; c.life--;
                    ctx.globalAlpha = Math.max(0, Math.min(1, c.life / 40));
                    ctx.fillStyle = c.color;
                    ctx.fillRect(c.x, c.y, c.size, c.size * 0.6);
                }
                confetti = confetti.filter(c => c.life > 0 && c.y < canvas.height + 20);
                ctx.globalAlpha = 1;
            }
        }
        requestAnimationFrame(physicsLoop);
    }
    requestAnimationFrame(physicsLoop);

    // ---- views / navigation (locked while a battle is in progress) ----
    function switchView(targetId) {
        views.forEach(v => v.classList.remove('active-view'));
        const targetView = comicModal.querySelector(`#${targetId}`);
        if (targetView) targetView.classList.add('active-view');
        if (targetId === 'comics-main-view') requestAnimationFrame(() => { resizeCanvas(); measure(); });
    }

    bubbleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (battleLocked || Date.now() < suppressClickUntil) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }
            switchView(btn.getAttribute('data-target'));
        });
    });

    backBtns.forEach(btn => btn.addEventListener('click', () => switchView('comics-main-view')));
});