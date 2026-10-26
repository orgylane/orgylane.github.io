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