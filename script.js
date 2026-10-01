const menuToggle = document.querySelector('.menu-toggle');
const navBar = document.querySelector('.nav-bar');

if (menuToggle && navBar) {
    menuToggle.addEventListener('click', () => {
        const isOpen = navBar.classList.toggle('open');
        menuToggle.setAttribute('aria-expanded', String(isOpen));
    });
}

// ==========================================================================
// EP ANNOUNCEMENT - edit EP_RELEASE_DATE to your real drop date/time
// ==========================================================================
 
const EP_RELEASE_DATE = new Date("2026-10-01T00:00:00");
 
const epModal = document.getElementById('ep-modal');
const epModalClose = document.getElementById('ep-modal-close');
const epSideRight = document.getElementById('ep-side-right');
 
const epSaveModal = document.getElementById('ep-save-modal');
const epSaveModalClose = document.getElementById('ep-save-modal-close');
const epSideLeft = document.getElementById('ep-side-left');
 
function openEpModal() {
    if (!epModal) return;
    epModal.classList.add('open');
    fireEpConfetti();
}
 
function closeEpModal() {
    if (!epModal) return;
    epModal.classList.remove('open');
}
 
function openEpSaveModal() {
    if (!epSaveModal) return;
    epSaveModal.classList.add('open');
    fireEpConfetti();
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
 
// show once per browser tab session, then only reopen via the shirt image trigger
// swap sessionStorage -> localStorage if you want it to show once per visitor ever
if (epModal && !sessionStorage.getItem('ep_modal_shown')) {
    setTimeout(() => {
        openEpModal();
        sessionStorage.setItem('ep_modal_shown', '1');
    }, 700);
}
 
function updateEpCountdown() {
    const dEl = document.getElementById('ep-d');
    const hEl = document.getElementById('ep-h');
    const mEl = document.getElementById('ep-m');
    const sEl = document.getElementById('ep-s');
    if (!dEl) return;
 
    const now = new Date();
    let diff = EP_RELEASE_DATE - now;
    if (diff < 0) diff = 0;
 
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
 
    dEl.textContent = String(d).padStart(2, '0');
    hEl.textContent = String(h).padStart(2, '0');
    mEl.textContent = String(m).padStart(2, '0');
    sEl.textContent = String(s).padStart(2, '0');
}
 
updateEpCountdown();
setInterval(updateEpCountdown, 1000);
 
// ---- confetti burst (plain canvas, no external libs) ----
const epCanvas = document.getElementById('ep-confetti-canvas');
const epCtx = epCanvas ? epCanvas.getContext('2d') : null;
 
function resizeEpCanvas() {
    if (!epCanvas) return;
    epCanvas.width = window.innerWidth;
    epCanvas.height = window.innerHeight;
}
resizeEpCanvas();
window.addEventListener('resize', resizeEpCanvas);
 
const epColors = ['#00ff00', '#ff00ff', '#ffffff', '#8b0000', '#ffcc00'];
let epParticles = [];
 
function fireEpConfetti() {
    if (!epCtx) return;
    epParticles = [];
    const originX = epCanvas.width / 2;
    const originY = epCanvas.height / 2 - 100;
 
    for (let i = 0; i < 140; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 7;
        epParticles.push({
            x: originX,
            y: originY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            size: 4 + Math.random() * 5,
            color: epColors[Math.floor(Math.random() * epColors.length)],
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 10,
            life: 100 + Math.random() * 40
        });
    }
    requestAnimationFrame(animateEpConfetti);
}
 
function animateEpConfetti() {
    epCtx.clearRect(0, 0, epCanvas.width, epCanvas.height);
    let alive = false;
    epParticles.forEach((p) => {
        if (p.life <= 0) return;
        alive = true;
        p.vy += 0.12;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.life -= 1;
        epCtx.save();
        epCtx.translate(p.x, p.y);
        epCtx.rotate((p.rotation * Math.PI) / 180);
        epCtx.globalAlpha = Math.max(p.life / 100, 0);
        epCtx.fillStyle = p.color;
        epCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        epCtx.restore();
    });
    if (alive) requestAnimationFrame(animateEpConfetti);
    else epCtx.clearRect(0, 0, epCanvas.width, epCanvas.height);
}
 