const roadScene = document.querySelector('.road-scene');
const journeyScenes = Array.from(document.querySelectorAll('.journey-chapter'), chapter => ({
  chapter,
  image: chapter.querySelector('.journey-image img')
}));
let roadFrame = null;

function drawRoad() {
  roadFrame = null;
  if (journeyScenes.length) {
    const viewport = window.innerHeight || document.documentElement.clientHeight || 1;
    const tops = journeyScenes.map(({ chapter }) => chapter.getBoundingClientRect().top);
    journeyScenes.forEach(({ chapter, image }, index) => {
      const top = tops[index];
      const nextTop = tops[index + 1];
      const lead = index === 0 ? 0 : viewport * .48;
      // Stop advancing this photograph when the next chapter enters the viewport.
      const travel = Math.min(viewport * .95, Math.max(0, (nextTop ?? Infinity) - top - viewport));
      const distance = Math.max(viewport * .48, travel + lead);
      const progress = Math.min(1, Math.max(0, (lead - Math.max(top, -travel)) / distance));
      const eased = 1 - (1 - progress) ** 1.6;
      const edge = Math.min(68, Math.max(0, top));
      chapter.style.setProperty('--journey-edge', edge.toFixed(1) + 'px');
      if (motion.matches) image.style.removeProperty('--journey-progress');
      else image.style.setProperty('--journey-progress', eased.toFixed(4));
    });
    return;
  }
  if (motion.matches) {
    roadScene.style.removeProperty('transform');
    return;
  }

  const range = pageScrollRange();
  const distance = pageScrollPosition();
  const progress = range ? distance / range : 0;
  const viewport = window.innerHeight || document.documentElement.clientHeight || 1;
  const nearTravel = distance / (distance + viewport * .72);
  const travel = mobileLayout.matches
    ? nearTravel * .57 + progress * .43
    : progress * (1.58 - .58 * progress);
  const scale = Math.pow(mobileLayout.matches ? 2.5 : 2.65, travel);
  const shift = mobileLayout.matches ? Math.min((scale - 1) * 13, 11) : 0;

  // Keep the road's vanishing point near the horizon while its foreground moves.
  roadScene.style.transform = 'translate3d(0, ' + shift.toFixed(3) + '%, 0) scale(' + scale.toFixed(4) + ')';
}

function queueRoadFrame() {
  if ((!motion.matches || journeyScenes.length) && roadFrame === null) {
    roadFrame = requestAnimationFrame(drawRoad);
  }
}

window.addEventListener('scroll', queueRoadFrame, { passive: true });
window.addEventListener('resize', queueRoadFrame);
if (window.visualViewport) window.visualViewport.addEventListener('resize', queueRoadFrame);
watchMedia(mobileLayout, queueRoadFrame);
window.addEventListener('pageshow', queueRoadFrame);
watchMedia(motion, () => {
  if (roadFrame !== null) cancelAnimationFrame(roadFrame);
  drawRoad();
});
document.documentElement.classList.add('road-motion-ready');
drawRoad();

if (typeof IntersectionObserver === 'function' && !motion.matches) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.remove('awaits-view');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px 50px' });

  for (const item of document.querySelectorAll('.reveal')) {
    if (item.getBoundingClientRect().top <= innerHeight + 40) continue;
    item.classList.add('ready', 'awaits-view');
    observer.observe(item);
  }
}

const carouselLayouts = new WeakMap();

function initializeCarousel(carousel) {
  const realign = carouselLayouts.get(carousel);
  if (realign) {
    realign();
    return;
  }
  const track = carousel.querySelector('.carousel-track');
  const slides = Array.from(track.children);
  const count = slides.length;
  const counter = carousel.querySelector('.carousel-count');
  if (count < 2) return;

  function copyEdge(slide) {
    const copy = slide.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    return copy;
  }

  track.prepend(copyEdge(slides[count - 1]));
  track.append(copyEdge(slides[0]));

  let position = 1;
  let pendingSteps = 0;
  let scrolling = false;
  const hintOverPhoto = carousel.classList.contains('car-carousel');
  let touching = false;
  let touchScrollStart = 0;
  let stopTimer;

  function trackWidth() {
    return track.getBoundingClientRect().width;
  }

  function scrollToSlot(slot, smooth = false) {
    const left = slot * trackWidth();
    if (smooth && !motion.matches && 'scrollBehavior' in document.documentElement.style &&
        typeof track.scrollTo === 'function') {
      try {
        track.scrollTo({ left, behavior: 'smooth' });
        return;
      } catch (error) {
        if (error.name !== 'TypeError') throw error;
      }
    }
    track.scrollLeft = left;
  }

  function moveOneStep() {
    if (touching || scrolling || !pendingSteps || !trackWidth()) return;
    const step = Math.sign(pendingSteps);
    pendingSteps -= step;
    if (hintOverPhoto) carousel.classList.add('has-used-carousel');
    scrolling = true;
    scrollToSlot(position + step, true);
    watchForStop();
  }

  function finishScroll() {
    clearTimeout(stopTimer);
    if (touching) return;
    const width = trackWidth();
    if (!width) {
      scrolling = false;
      return;
    }

    const slot = Math.max(0, Math.min(count + 1, Math.round(track.scrollLeft / width)));
    const previous = position;
    position = slot === 0 ? count : slot === count + 1 ? 1 : slot;
    if (position !== previous) carousel.classList.add('has-used-carousel');
    // The edge copy allows a normal slide animation before returning to its original.
    if (slot !== position) scrollToSlot(position);
    if (counter) counter.textContent = position + ' / ' + count;
    scrolling = false;
    if (pendingSteps) requestAnimationFrame(moveOneStep);
  }

  function watchForStop() {
    clearTimeout(stopTimer);
    if (!touching) stopTimer = setTimeout(finishScroll, 130);
  }

  function queueStep(step) {
    pendingSteps += step;
    moveOneStep();
  }

  for (const arrow of carousel.querySelectorAll('.carousel-arrow')) {
    arrow.addEventListener('click', () => queueStep(Number(arrow.dataset.step)));
  }

  track.addEventListener('scroll', () => {
    if (hintOverPhoto && touching && Math.abs(track.scrollLeft - touchScrollStart) >= 6) {
      carousel.classList.add('has-used-carousel');
    }
    scrolling = true;
    watchForStop();
  }, { passive: true });

  track.addEventListener('touchstart', () => {
    touching = true;
    touchScrollStart = track.scrollLeft;
    pendingSteps = 0;
    clearTimeout(stopTimer);
  }, { passive: true });

  function finishTouch(event) {
    if (event.touches.length) return;
    touching = false;
    watchForStop();
  }

  track.addEventListener('touchend', finishTouch, { passive: true });
  track.addEventListener('touchcancel', finishTouch, { passive: true });

  track.addEventListener('keydown', (event) => {
    if (event.target !== track) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      queueStep(event.key === 'ArrowLeft' ? -1 : 1);
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      pendingSteps = 0;
      scrollToSlot(event.key === 'Home' ? 1 : count);
      finishScroll();
    }
  });

  let width = trackWidth();

  function alignTrack() {
    const newWidth = trackWidth();
    if (!newWidth) return;
    width = newWidth;
    scrollToSlot(position);
    finishScroll();
  }

  function onResize() {
    if (width !== trackWidth()) alignTrack();
  }

  carouselLayouts.set(carousel, alignTrack);
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(onResize).observe(track);
  } else {
    window.addEventListener('resize', onResize);
  }

  scrollToSlot(position);
  carousel.classList.add('is-ready');
}

const countryChoices = Array.from(document.querySelectorAll('.country-choice'));

countryChoices.forEach((choice) => {
  choice.addEventListener('change', () => {
    if (choice.checked) activateCountry(choice);
  });
});

function activateCountry(choice) {
  const panel = document.getElementById(choice.value);
  initializeCarousel(panel.querySelector('.country-carousel'));
}

function selectLinkedCountry() {
  const linked = countryChoices.find((choice) => '#' + choice.value === window.location.hash);
  if (!linked) return false;

  linked.checked = true;
  activateCountry(linked);
  const panel = document.getElementById(linked.value);
  requestAnimationFrame(() => {
    if (window.location.hash === '#' + panel.id && linked.checked) panel.scrollIntoView();
  });
  return true;
}

if (countryChoices.length) {
  if (!selectLinkedCountry()) activateCountry(countryChoices.find((choice) => choice.checked));
  window.addEventListener('hashchange', selectLinkedCountry);
}

for (const carousel of document.querySelectorAll('.carousel')) {
  if (!carousel.closest('.country-panel')) initializeCarousel(carousel);
}
