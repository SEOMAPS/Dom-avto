{
  const catalog = document.querySelector('[data-catalog]');
  if (catalog) {
    const grid = catalog.querySelector('.catalog-grid');
    const cards = [...grid.children];
    const filters = [...catalog.querySelectorAll('[name="catalog-country"]')];
    const search = catalog.querySelector('#catalog-search');
    const sort = catalog.querySelector('#catalog-sort');
    const count = catalog.querySelector('.catalog-count');
    const empty = catalog.querySelector('.catalog-empty');
    const more = catalog.querySelector('.catalog-more');
    const reset = catalog.querySelector('.catalog-reset');
    const preview = catalog.dataset.catalog === 'preview';
    const pageSize = 12;
    let limit = pageSize;

    function normalize(value) {
      return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zа-я0-9]/g, '');
    }

    function readCountry() {
      if (preview) {
        return location.hash.match(/^#preview-catalog(?:-(jp|kg|kr|cn))?$/)?.[1] || '';
      }
      return new URLSearchParams(location.search).get('country') || '';
    }

    function setCountry(country) {
      const filter = filters.find(option => option.value === country) || filters[0];
      filter.checked = true;
    }

    function rememberCountry() {
      const url = new URL(location.href);
      const country = filters.find(option => option.checked).value;
      if (preview) {
        url.hash = country ? '#preview-catalog-' + country : '#preview-catalog';
      } else if (country) {
        url.searchParams.set('country', country);
      } else {
        url.searchParams.delete('country');
      }
      if (url.href !== location.href) {
        try {
          history.pushState(null, '', url);
        } catch (error) {
          if (preview) location.hash = url.hash;
        }
      }
    }

    function update() {
      const country = filters.find(option => option.checked).value;
      const term = normalize(search.value);
      const matches = cards.filter(card =>
        (!country || card.dataset.country === country) && normalize(card.dataset.model).includes(term)
      );
      const order = sort.value;
      if (order) matches.sort((a, b) => (Number(a.dataset.price) - Number(b.dataset.price)) * Number(order));
      const shown = new Set(matches.slice(0, limit));
      for (const card of cards) card.hidden = !shown.has(card);
      grid.append(...matches);
      count.textContent = matches.length ? 'Показано ' + shown.size + ' из ' + matches.length : 'Найдено 0 моделей';
      empty.hidden = matches.length > 0;
      more.hidden = matches.length <= limit;
      reset.hidden = !country && !search.value && !order;
    }

    function filterChanged() {
      limit = pageSize;
      update();
    }

    for (const filter of filters) filter.addEventListener('change', () => {
      rememberCountry();
      filterChanged();
    });
    search.addEventListener('input', filterChanged);
    sort.addEventListener('change', filterChanged);
    reset.addEventListener('click', () => {
      setCountry('');
      search.value = '';
      sort.value = '';
      rememberCountry();
      filterChanged();
      search.focus();
    });
    more.addEventListener('click', () => {
      const firstNew = [...grid.children].filter(card => !card.hidden).length;
      limit += pageSize;
      update();
      [...grid.children].filter(card => !card.hidden)[firstNew]?.focus({preventScroll:true});
    });

    function restoreCountry() {
      if (preview && !location.hash.startsWith('#preview-catalog')) return;
      setCountry(readCountry());
      search.value = '';
      sort.value = '';
      filterChanged();
    }

    window.addEventListener('popstate', restoreCountry);
    if (preview) window.addEventListener('hashchange', restoreCountry);
    setCountry(readCountry());
    catalog.dataset.ready = 'true';
    update();

    const surface = catalog.closest('.catalog-shell');
    const light = surface.querySelector('.catalog-light');
    const finePointer = matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)');
    const pointerArea = preview ? surface : document.body;
    pointerArea.addEventListener('pointermove', event => {
      if (!finePointer.matches || event.pointerType === 'touch') return;
      const x = (event.clientX / innerWidth - .5) * 38;
      const y = (event.clientY / innerHeight - .5) * 28;
      light.style.setProperty('--catalog-x', x.toFixed(1) + 'px');
      light.style.setProperty('--catalog-y', y.toFixed(1) + 'px');
    }, { passive: true });
    pointerArea.addEventListener('pointerleave', () => {
      light.style.removeProperty('--catalog-x');
      light.style.removeProperty('--catalog-y');
    });
  }
}
