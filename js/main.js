/* ==========================================================================
   Коворкинг «Станция» — интерактив лендинга (vanilla JS, без зависимостей)
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  /* ---------- Шапка: уплотнение при скролле ---------- */
  function initHeader() {
    const header = $('[data-header]');
    const sentinel = $('[data-header-sentinel]');
    if (!header || !sentinel) return;

    new IntersectionObserver(([entry]) => {
      header.classList.toggle('is-condensed', !entry.isIntersecting);
    }).observe(sentinel);
  }

  /* ---------- Бургер-меню ---------- */
  function initMobileNav() {
    const header = $('[data-header]');
    const toggle = $('[data-nav-toggle]');
    if (!header || !toggle) return;

    const desktop = window.matchMedia('(min-width: 1024px)');
    const background = [$('main'), $('footer')].filter(Boolean);
    let isOpen = false;

    const setOpen = (open, { returnFocus = false } = {}) => {
      isOpen = open;
      header.classList.toggle('is-menu-open', open);
      root.classList.toggle('is-locked', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      // Пока меню открыто, контент под ним недоступен ни мышью, ни с клавиатуры
      background.forEach((el) => {
        el.inert = open;
      });
      if (returnFocus) toggle.focus();
    };

    toggle.addEventListener('click', () => setOpen(!isOpen));

    header.addEventListener('click', (event) => {
      if (isOpen && event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen) setOpen(false, { returnFocus: true });
    });

    desktop.addEventListener('change', (event) => {
      if (event.matches && isOpen) setOpen(false);
    });
  }

  /* ---------- Подсветка пункта меню текущей секции ---------- */
  function initScrollSpy() {
    const links = $$('.nav__link[href^="#"]');
    const sections = links.map((link) => document.getElementById(link.hash.slice(1))).filter(Boolean);
    if (!sections.length) return;

    const visible = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        });
        const current = sections.filter((section) => visible.has(section)).pop();
        links.forEach((link) => {
          if (current && link.hash === `#${current.id}`) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      },
      { rootMargin: '-35% 0px -60% 0px' },
    );
    sections.forEach((section) => observer.observe(section));
  }

  /* ---------- Плавное появление блоков ---------- */
  function initReveal() {
    const items = $$('[data-reveal]');
    if (!items.length) return;

    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    items.forEach((el) => observer.observe(el));
  }

  /* ---------- Счётчики в блоке цифр ---------- */
  function initCounters() {
    const counters = $$('[data-count]');
    if (!counters.length || reducedMotion.matches || !('IntersectionObserver' in window)) return;

    const duration = 1600;
    const easeOutCubic = (t) => 1 - (1 - t) ** 3;

    const run = (el) => {
      const target = Number(el.dataset.count);
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        el.dataset.value = String(Math.round(target * easeOutCubic(progress)));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    // Число рисуется псевдоэлементом из data-value, ширина зарезервирована под итог (см. CSS)
    counters.forEach((el) => {
      el.dataset.value = '0';
      el.textContent = '';
    });

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          obs.unobserve(entry.target);
          run(entry.target);
        });
      },
      { threshold: 0.6 },
    );
    counters.forEach((el) => observer.observe(el));
  }

  /* ---------- Форма бронирования ---------- */
  const PHONE_LENGTH = 11;
  const NAME_PATTERN = /^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё' -]*$/;

  const pad = (n) => String(n).padStart(2, '0');

  // Локальная (не UTC) дата в формате input[type=date]: YYYY-MM-DD
  const todayISO = () => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  };

  const validators = {
    name(value) {
      const name = value.trim();
      if (!name) return 'Введите имя';
      if (name.length < 2) return 'Имя слишком короткое';
      if (!NAME_PATTERN.test(name)) return 'Используйте буквы, пробел или дефис';
      return '';
    },
    phone(value) {
      const digits = value.replace(/\D/g, '');
      if (!digits) return 'Введите номер телефона';
      if (digits.length !== PHONE_LENGTH) return 'Номер неполный: +7 (XXX) XXX-XX-XX';
      return '';
    },
    people: (value) => (value ? '' : 'Выберите количество человек'),
    space: (value) => (value ? '' : 'Выберите тип пространства'),
    date(value) {
      if (!value) return 'Выберите дату';
      if (value < todayISO()) return 'Дата не может быть раньше сегодняшней';
      return '';
    },
  };

  function validateField(field) {
    const validate = validators[field.name];
    if (!validate) return true;
    const message = validate(field.value);
    const error = document.getElementById(field.getAttribute('aria-describedby'));
    field.setAttribute('aria-invalid', String(Boolean(message)));
    if (error) error.textContent = message;
    return !message;
  }

  function formatPhone(rawDigits) {
    if (!rawDigits) return '';
    let digits = rawDigits;
    if (digits[0] === '8') digits = `7${digits.slice(1)}`;
    if (digits[0] !== '7') digits = `7${digits}`;
    const rest = digits.slice(1, PHONE_LENGTH);

    let out = '+7';
    if (rest.length) out += ` (${rest.slice(0, 3)}`;
    if (rest.length > 3) out += `) ${rest.slice(3, 6)}`;
    if (rest.length > 6) out += `-${rest.slice(6, 8)}`;
    if (rest.length > 8) out += `-${rest.slice(8, 10)}`;
    return out;
  }

  function initPhoneMask(input) {
    let digitsBefore = '';

    input.addEventListener('beforeinput', () => {
      digitsBefore = input.value.replace(/\D/g, '');
    });

    input.addEventListener('input', (event) => {
      const { value } = input;
      const caret = input.selectionStart ?? value.length;
      const caretAtEnd = caret >= value.length;
      let digits = value.replace(/\D/g, '');
      let digitsLeftOfCaret = value.slice(0, caret).replace(/\D/g, '').length;

      // Backspace по разделителю («-», «)», пробел) — удаляем цифру перед ним
      if (event.inputType === 'deleteContentBackward' && digits === digitsBefore && digitsLeftOfCaret > 0) {
        digits = digits.slice(0, digitsLeftOfCaret - 1) + digits.slice(digitsLeftOfCaret);
        digitsLeftOfCaret -= 1;
      }

      const formatted = formatPhone(digits);
      input.value = formatted;

      // Правка в середине номера: возвращаем курсор после той же по счёту цифры
      if (!caretAtEnd && document.activeElement === input) {
        let position = 0;
        let seen = 0;
        while (position < formatted.length && seen < digitsLeftOfCaret) {
          if (/\d/.test(formatted[position])) seen += 1;
          position += 1;
        }
        input.setSelectionRange(position, position);
      }
    });
  }

  function showSuccess(data) {
    const dialog = $('[data-success-modal]');
    const text = $('[data-success-text]');
    if (!dialog) return;

    if (text) {
      const firstName = data.name.split(/\s+/)[0];
      const date = new Date(`${data.date}T00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
      const phone = data.phone.replace(/ /g, ' ').replace(/-/g, '‑');
      text.textContent = `${firstName}, спасибо! Мы позвоним по номеру ${phone} в течение 15 минут, чтобы подтвердить бронь на ${date}.`;
    }

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function initBookingForm() {
    const form = $('[data-booking-form]');
    if (!form) return;

    // Своя валидация вместо системных подсказок; без JS остаётся нативная
    form.noValidate = true;
    const fields = ['name', 'phone', 'people', 'space', 'date'].map((name) => form.elements.namedItem(name));
    // Иначе Chrome сразу объявляет пустые required-поля «недопустимыми» для скринридеров
    const resetValidity = () => fields.forEach((field) => field.setAttribute('aria-invalid', 'false'));
    resetValidity();
    const dateInput = form.elements.namedItem('date');
    dateInput.min = todayISO();
    initPhoneMask(form.elements.namedItem('phone'));

    // После первой ошибки поле перепроверяется на лету
    const revalidate = (event) => {
      if (event.target.getAttribute('aria-invalid') === 'true') validateField(event.target);
    };
    form.addEventListener('input', revalidate);
    form.addEventListener('change', revalidate);
    form.addEventListener('focusout', (event) => {
      if (fields.includes(event.target) && event.target.value) validateField(event.target);
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      dateInput.min = todayISO(); // вдруг страница открыта со вчерашнего дня

      const invalid = fields.filter((field) => !validateField(field));
      if (invalid.length) {
        invalid[0].focus();
        return;
      }

      const data = Object.fromEntries(new FormData(form));
      data.name = data.name.trim();
      console.log('[Станция] Заявка на бронирование:', data);

      showSuccess(data);
      form.reset();
      resetValidity();
    });
  }

  /* ---------- Кнопки «Выбрать» в тарифах подставляют тип места в форму ---------- */
  function initPlanLinks() {
    const form = $('[data-booking-form]');
    if (!form) return;
    const space = form.elements.namedItem('space');
    const name = form.elements.namedItem('name');

    $$('[data-plan]').forEach((link) => {
      link.addEventListener('click', () => {
        space.value = link.dataset.plan;
        if (space.getAttribute('aria-invalid') === 'true') validateField(space);
        // Скроллит к форме сам браузер по якорю, фокус ставим без прыжка
        name.focus({ preventScroll: true });
      });
    });
  }

  /* ---------- Общие правила для <dialog>: клик по фону и кнопки закрытия ---------- */
  function initDialogs() {
    $$('dialog').forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog || event.target.closest('[data-dialog-close]')) dialog.close();
      });
    });
  }

  /* ---------- Лайтбокс галереи ---------- */
  function initLightbox() {
    const dialog = $('[data-lightbox]');
    const links = $$('[data-lightbox-item]');
    if (!dialog || !links.length || typeof dialog.showModal !== 'function') return;

    const img = $('[data-lightbox-img]', dialog);
    const caption = $('[data-lightbox-caption]', dialog);
    const counter = $('[data-lightbox-counter]', dialog);
    const stage = $('[data-lightbox-stage]', dialog);
    const figure = $('figure', dialog);
    const wrap = (i) => (i + links.length) % links.length;
    let index = 0;

    const preload = (i) => {
      const image = new Image();
      image.src = links[wrap(i)].href;
    };

    const show = (i) => {
      index = wrap(i);
      const link = links[index];
      const thumb = $('img', link);
      if (img.src !== link.href) {
        img.classList.add('is-loading');
        img.src = link.href;
      }
      img.alt = thumb ? thumb.alt : '';
      caption.textContent = link.dataset.caption || '';
      counter.textContent = `${index + 1} / ${links.length}`;
      preload(index + 1);
      preload(index - 1);
    };

    img.addEventListener('load', () => img.classList.remove('is-loading'));

    links.forEach((link, i) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        show(i);
        dialog.showModal();
      });
    });

    $('[data-lightbox-prev]', dialog).addEventListener('click', () => show(index - 1));
    $('[data-lightbox-next]', dialog).addEventListener('click', () => show(index + 1));

    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        show(index - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        show(index + 1);
      }
    });

    // Свайп на тач-экранах (и перетаскивание мышью)
    let startX = null;
    let swiped = false;
    stage.addEventListener('pointerdown', (event) => {
      startX = event.clientX;
      swiped = false;
    });
    stage.addEventListener('pointerup', (event) => {
      if (startX === null) return;
      const dx = event.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50) {
        swiped = true;
        show(index + (dx < 0 ? 1 : -1));
      }
    });
    stage.addEventListener('click', (event) => {
      if (swiped) {
        swiped = false;
        return;
      }
      if (event.target === stage || event.target === figure) dialog.close();
    });
  }

  /* ---------- Слайдер отзывов (scroll-snap + кнопки и точки) ---------- */
  function initSlider(slider) {
    const track = $('[data-slider-track]', slider);
    const prev = $('[data-slider-prev]', slider);
    const next = $('[data-slider-next]', slider);
    const dotsWrap = $('[data-slider-dots]', slider);
    const slides = track ? Array.from(track.children) : [];
    if (slides.length < 2) return;

    let dots = [];
    const step = () => slides[1].offsetLeft - slides[0].offsetLeft;
    const maxIndex = () => Math.max(0, Math.round((track.scrollWidth - track.clientWidth) / step()));
    const currentIndex = () => Math.min(maxIndex(), Math.round(track.scrollLeft / step()));

    const goTo = (i) => {
      const target = Math.max(0, Math.min(i, maxIndex()));
      track.scrollTo({ left: target * step(), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    };

    const renderDots = () => {
      const count = maxIndex() + 1;
      if (dots.length === count) return;
      const current = currentIndex();
      dots = Array.from({ length: count }, (_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'slider__dot';
        dot.setAttribute('aria-label', `Показать отзыв ${i + 1}`);
        // Активную точку помечаем сразу, иначе при пересоздании она «мигает» серым
        if (i === current) dot.setAttribute('aria-current', 'true');
        dot.addEventListener('click', () => goTo(i));
        return dot;
      });
      dotsWrap.replaceChildren(...dots);
      dotsWrap.hidden = count < 2;
    };

    const update = () => {
      const current = currentIndex();
      const max = maxIndex();
      dots.forEach((dot, i) => {
        if (i === current) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
      prev.setAttribute('aria-disabled', String(current <= 0));
      next.setAttribute('aria-disabled', String(current >= max));
    };

    prev.addEventListener('click', () => goTo(currentIndex() - 1));
    next.addEventListener('click', () => goTo(currentIndex() + 1));

    let frame = 0;
    track.addEventListener(
      'scroll',
      () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(update);
      },
      { passive: true },
    );

    new ResizeObserver(() => {
      renderDots();
      update();
    }).observe(track);
  }

  /* ---------- Текущий год в подвале ---------- */
  function initYear() {
    const year = String(new Date().getFullYear());
    $$('[data-year]').forEach((el) => {
      el.textContent = year;
    });
  }

  initHeader();
  initMobileNav();
  initScrollSpy();
  initReveal();
  initCounters();
  initBookingForm();
  initPlanLinks();
  initDialogs();
  initLightbox();
  $$('[data-slider]').forEach(initSlider);
  initYear();
})();
