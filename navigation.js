const menu = document.querySelector('#site-menu');
const header = document.querySelector('.site-header');
const keepHeaderVisible = header.hasAttribute('data-keep-visible');
const menuToggle = document.querySelector('#menu-toggle');
const menuClose = menu.querySelector('.menu-close');
const mobileLayout = matchMedia('(max-width: 780px), (max-width: 1024px) and (pointer: coarse)');
const motion = matchMedia('(prefers-reduced-motion: reduce)');

function watchMedia(query, listener) {
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', listener);
  } else if (typeof query.addListener === 'function') {
    query.addListener(listener);
  }
}

function menuIsOpen() {
  return menu.classList.contains('is-open') || window.location.hash === '#site-menu';
}

function syncMenu() {
  const open = menuIsOpen();
  header.classList.toggle('is-menu-open', open);
  document.body.classList.toggle('has-open-menu', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  if (open) resetHeader();
}

function toggleMenu() {
  if (menuIsOpen()) {
    closeMenu(true);
    return;
  }

  menu.classList.add('is-open');
  syncMenu();
  menuClose.focus({ preventScroll: true });
}

function closeMenu(restoreFocus, clearHash = true) {
  menu.classList.remove('is-open');
  if (clearHash && window.location.hash === '#site-menu') window.location.hash = '#menu-closed';
  syncMenu();
  if (restoreFocus) menuToggle.focus({ preventScroll: true });
}

menuToggle.addEventListener('click', (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  toggleMenu();
});
menuToggle.addEventListener('keydown', (event) => {
  if (event.key !== ' ') return;
  event.preventDefault();
  toggleMenu();
});
menu.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link) return;
  if (link.matches('.menu-close, .menu-backdrop')) {
    event.preventDefault();
    closeMenu(true);
  } else {
    closeMenu(false);
  }
});
window.addEventListener('hashchange', syncMenu);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuIsOpen()) {
    event.preventDefault();
    closeMenu(true);
  }
});

function pageScrollRange() {
  const scroller = document.scrollingElement || document.documentElement;
  return Math.max(0, scroller.scrollHeight - (scroller.clientHeight || window.innerHeight));
}

function pageScrollPosition() {
  const scroller = document.scrollingElement || document.documentElement;
  const y = typeof window.pageYOffset === 'number' ? window.pageYOffset : scroller.scrollTop;
  return Math.max(0, Math.min(y || 0, pageScrollRange()));
}

let lastHeaderScrollY = pageScrollPosition();

function updateMobileHeader() {
  const y = pageScrollPosition();
  if (keepHeaderVisible || !mobileLayout.matches || y <= 8 || menuIsOpen()) {
    header.classList.remove('is-scrolled-away');
    lastHeaderScrollY = y;
    return;
  }

  const distance = y - lastHeaderScrollY;
  if (Math.abs(distance) < 3) return;
  header.classList.toggle('is-scrolled-away', distance > 0);
  lastHeaderScrollY = y;
}

function resetHeader() {
  lastHeaderScrollY = pageScrollPosition();
  header.classList.remove('is-scrolled-away');
}

watchMedia(mobileLayout, resetHeader);
header.addEventListener('focusin', (event) => {
  if (window.CSS && CSS.supports('selector(:focus-visible)') && event.target.matches(':focus-visible')) {
    resetHeader();
  }
});
syncMenu();
let headerTouchPoint = null;

window.addEventListener('touchstart', (event) => {
  headerTouchPoint = event.touches.length === 1 ? event.touches[0] : null;
}, { passive: true });

window.addEventListener('touchmove', (event) => {
  if (keepHeaderVisible || !mobileLayout.matches || menuIsOpen() || !headerTouchPoint || event.touches.length !== 1) return;

  const touch = event.touches[0];
  const horizontal = touch.clientX - headerTouchPoint.clientX;
  const vertical = touch.clientY - headerTouchPoint.clientY;
  if (Math.max(Math.abs(horizontal), Math.abs(vertical)) < 6) return;

  headerTouchPoint = touch;
  if (Math.abs(vertical) <= Math.abs(horizontal)) return;
  const y = pageScrollPosition();
  if (vertical > 0 || y <= 8) {
    resetHeader();
  } else {
    header.classList.add('is-scrolled-away');
    lastHeaderScrollY = y;
  }
}, { passive: true });

for (const event of ['touchend', 'touchcancel']) {
  window.addEventListener(event, () => {
    headerTouchPoint = null;
  }, { passive: true });
}

window.addEventListener('scroll', updateMobileHeader, { passive: true });
window.addEventListener('pageshow', () => {
  resetHeader();
  syncMenu();
});
document.documentElement.classList.add('navigation-ready');
