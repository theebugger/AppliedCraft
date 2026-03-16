/**
 * Applied Craft — Main Script
 *
 * Responsibilities:
 * 1. Diffusion wordmark animation (A and I seeds → full reveal)
 * 2. Wordmark scroll transition (hero → nav crossfade)
 * 3. Scroll-triggered reveal animations (Intersection Observer)
 * 4. Nav scroll state + theme toggle
 */

(function () {
  'use strict';

  // Shared flag: true once the hero reveal sequence is complete
  // (all letters resolved, CRAFT/tagline/CTA visible).
  // The scroll transition only activates after this.
  var heroReady = false;

  /* ═══════════════════════════════════════════════
     DIFFUSION WORDMARK ANIMATION

     Concept: The letters A and I in "APPLIED" appear first —
     they are the "seeds." The remaining letters resolve from
     rapidly cycling noise characters, spreading outward from
     the seed positions. This mirrors diffusion model denoising:
     noise → clarity. A visual metaphor for the brand.

     After APPLIED fully resolves, CRAFT fades in below,
     followed by the tagline and CTA.
     ═══════════════════════════════════════════════ */

  const WORD = 'APPLIED';
  const SEED_INDICES = new Set([0, 4]); // A and I
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const NOISE_CHARS = '+-·=|/\\ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Resolution schedule: spreading outward from A (0) and I (4)
  // Times are ms after noise starts — compressed for snappier feel
  const RESOLVE_SCHEDULE = [
    { index: 1, time: 500 },   // P — adjacent to A
    { index: 3, time: 680 },   // L — adjacent to I
    { index: 2, time: 920 },   // P — between groups
    { index: 5, time: 1180 },  // E — spreading out
    { index: 6, time: 1450 },  // D — furthest from seeds
  ];

  function initWordmark() {
    const container = document.getElementById('wordmark-applied');
    const craftEl = document.getElementById('wordmark-craft');
    const taglineEl = document.getElementById('hero-tagline');
    const ctaEl = document.getElementById('hero-cta');

    if (!container) return;

    const letters = Array.from(container.querySelectorAll('.wm-letter'));
    const resolved = new Set();
    let noiseInterval = null;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Skip animation entirely — show everything immediately
      letters.forEach((el, i) => {
        el.textContent = WORD[i];
        el.classList.add('resolved');
      });
      craftEl.classList.add('visible');
      taglineEl.classList.add('visible');
      ctaEl.classList.add('visible');
      heroReady = true;
      return;
    }

    // ── Phase 1: Show seed letters (A and I) ──
    setTimeout(() => {
      SEED_INDICES.forEach(i => {
        letters[i].textContent = WORD[i];
        letters[i].classList.add('seed');
        resolved.add(i);
      });
    }, 300);

    // ── Phase 2: Start noise on remaining positions ──
    // Brief beat after seeds appear (~250ms of "AI" visible alone)
    setTimeout(() => {
      // Show noise characters cycling at ~55ms (same speed)
      noiseInterval = setInterval(() => {
        letters.forEach((el, i) => {
          if (!resolved.has(i)) {
            const charSet = resolved.size < 4 ? NOISE_CHARS : CHARS;
            el.textContent = charSet[Math.floor(Math.random() * charSet.length)];
            el.classList.add('noise');
            el.classList.remove('resolving');
          }
        });
      }, 55);
    }, 550);

    // ── Phase 3: Resolve letters according to schedule ──
    const noiseStartTime = 550;

    RESOLVE_SCHEDULE.forEach(({ index, time }) => {
      // Deceleration phase: slow down cycling before lock-in
      const decelStart = noiseStartTime + time - 350;
      const resolveTime = noiseStartTime + time;

      // Start deceleration
      setTimeout(() => {
        if (letters[index]) {
          letters[index].classList.remove('noise');
          letters[index].classList.add('resolving');
        }
      }, decelStart);

      // Run a brief deceleration sequence
      let decelCount = 0;
      const decelInterval = setInterval(() => {
        if (letters[index] && !resolved.has(index)) {
          letters[index].textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
          decelCount++;
        }
        if (decelCount >= 3) {
          clearInterval(decelInterval);
        }
      }, 100);

      // Lock in the correct letter
      setTimeout(() => {
        clearInterval(decelInterval);
        if (letters[index]) {
          letters[index].textContent = WORD[index];
          letters[index].classList.remove('noise', 'resolving');
          letters[index].classList.add('resolved');
          resolved.add(index);
        }

        // When all letters are resolved
        if (resolved.size === WORD.length) {
          clearInterval(noiseInterval);

          // Show CRAFT — let it breathe after the wordmark resolves
          setTimeout(() => {
            craftEl.classList.add('visible');
          }, 400);

          // Show tagline
          setTimeout(() => {
            taglineEl.classList.add('visible');
          }, 800);

          // Show CTA
          setTimeout(() => {
            ctaEl.classList.add('visible');
            heroReady = true;
          }, 1200);
        }
      }, resolveTime);
    });
  }


  /* ═══════════════════════════════════════════════
     WORDMARK SCROLL TRANSITION

     As the user scrolls past the hero, the wordmark
     scales down and fades while the nav wordmark fades
     in. The brain perceives one element traveling —
     Gestalt apparent motion. Only activates after the
     diffusion animation completes (heroReady flag).

     Only transform + opacity are animated for GPU
     compositing. No layout thrashing.
     ═══════════════════════════════════════════════ */

  function initWordmarkScroll() {
    var wordmark = document.querySelector('.wordmark');
    var hero = document.querySelector('.hero');
    var navWordmark = document.querySelector('.nav-wordmark');

    if (!wordmark || !hero || !navWordmark) return;

    var ticking = false;

    function update() {
      var heroHeight = hero.offsetHeight;
      var scrollY = window.scrollY;

      // Before the animation is done, keep nav wordmark hidden
      if (!heroReady) {
        navWordmark.style.opacity = '0';
        ticking = false;
        return;
      }

      // Transition zone: 5% → 40% of hero height
      var start = heroHeight * 0.05;
      var end = heroHeight * 0.40;
      var progress = Math.max(0, Math.min(1, (scrollY - start) / (end - start)));

      // Hero wordmark: gentle scale-down, slight upward drift, fade
      var scale = 1 - (progress * 0.25);
      var translateY = -(progress * 16);
      wordmark.style.transform =
        'scale(' + scale + ') translateY(' + translateY + 'px)';
      wordmark.style.opacity = 1 - progress;

      // Nav wordmark: fade in (starts at 50% of range, so there's
      // a brief moment of overlap — the apparent-motion sweet spot)
      var navProgress = Math.max(0, Math.min(1, (progress - 0.5) / 0.5));
      navWordmark.style.opacity = navProgress;

      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });

    // Set initial state on load
    update();
  }


  /* ═══════════════════════════════════════════════
     SCROLL REVEAL

     Intersection Observer triggers reveal animations
     on elements with the .reveal class as they enter
     the viewport. Stagger is handled via CSS nth-child
     transition-delay.
     ═══════════════════════════════════════════════ */

  function initScrollReveal() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      document.querySelectorAll('.reveal').forEach(el => {
        el.classList.add('visible');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    document.querySelectorAll('.reveal').forEach(el => {
      observer.observe(el);
    });
  }


  /* ═══════════════════════════════════════════════
     NAV SCROLL STATE

     Adds a subtle bottom border to the nav when the
     user scrolls past the initial viewport.
     ═══════════════════════════════════════════════ */

  function initNavScroll() {
    const nav = document.querySelector('.nav');
    if (!nav) return;

    let ticking = false;

    function updateNav() {
      if (window.scrollY > 60) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateNav);
        ticking = true;
      }
    }, { passive: true });
  }


  /* ═══════════════════════════════════════════════
     SMOOTH SCROLL FOR ANCHOR LINKS

     Handles clicks on anchor links with smooth scroll
     and offset for the fixed nav.
     ═══════════════════════════════════════════════ */

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const targetId = anchor.getAttribute('href');
        if (targetId === '#') return;

        const target = document.querySelector(targetId);
        if (!target) return;

        e.preventDefault();

        const navHeight = document.querySelector('.nav')?.offsetHeight || 0;
        const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight + 80;

        // If scrolling past the hero, force the nav wordmark visible
        var hero = document.querySelector('.hero');
        var navWm = document.querySelector('.nav-wordmark');
        var wm = document.querySelector('.wordmark');
        if (hero && navWm && targetPosition > hero.offsetHeight * 0.4) {
          heroReady = true;
          navWm.style.opacity = '1';
          if (wm) {
            wm.style.opacity = '0';
            wm.style.transform = 'scale(0.75) translateY(-16px)';
          }
        }

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth',
        });
      });
    });
  }


  /* ═══════════════════════════════════════════════
     SHOW MORE ESSAYS

     Reveals hidden post cards with a staggered
     animation, then removes the button.
     ═══════════════════════════════════════════════ */

  function initShowMore() {
    var btn = document.getElementById('posts-show-more');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var hidden = document.querySelectorAll('.post-card--hidden');
      if (!hidden.length) return;

      // Unhide all — they start at opacity 0 via .reveal
      hidden.forEach(function (card) {
        card.classList.remove('post-card--hidden');
      });

      // Staggered reveal
      hidden.forEach(function (card, i) {
        setTimeout(function () {
          card.classList.add('visible');
        }, 120 * (i + 1));
      });

      // Remove the button after reveal
      setTimeout(function () {
        btn.style.display = 'none';
      }, 120 * (hidden.length + 1));
    });
  }


  /* ═══════════════════════════════════════════════
     SUBSCRIBE FORM

     Submits via fetch to Formspree (or any endpoint
     that accepts JSON POST). No page reload.

     To activate: replace YOUR_FORM_ID below with
     your Formspree form ID from https://formspree.io
     ═══════════════════════════════════════════════ */

  // ── Replace with your Formspree form ID ──
  var FORM_ENDPOINT = 'https://formspree.io/f/xpqyyaar';

  function initSubscribe() {
    var forms = document.querySelectorAll('.subscribe-form');
    if (!forms.length) return;

    forms.forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();

        var input = form.querySelector('.subscribe-input');
        var button = form.querySelector('.subscribe-button');
        var email = input.value.trim();

        if (!email) return;

        // Loading state
        var originalText = button.textContent;
        button.textContent = 'Sending\u2026';
        button.disabled = true;
        input.disabled = true;

        fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ email: email }),
        })
          .then(function (res) {
            if (res.ok) {
              // Success — replace form with confirmation
              var wrapper = form.closest('.subscribe-inner');
              if (wrapper) {
                var heading = wrapper.querySelector('.subscribe-heading');
                var lead = wrapper.querySelector('.subscribe-lead');
                var fine = wrapper.querySelector('.subscribe-fine-print');

                if (heading) heading.textContent = "You\u2019re in";
                if (lead) {
                  lead.textContent = 'First essay hits your inbox soon.';
                  lead.style.fontStyle = 'normal';
                }
                if (fine) fine.textContent = email;
                form.style.display = 'none';
              }
            } else {
              throw new Error('Submission failed');
            }
          })
          .catch(function () {
            // Error state
            button.textContent = 'Try again';
            button.disabled = false;
            input.disabled = false;
            input.style.borderColor = 'var(--color-accent)';

            // Show inline error
            var existing = form.querySelector('.subscribe-error');
            if (!existing) {
              var err = document.createElement('p');
              err.className = 'subscribe-error';
              err.textContent = 'Something went wrong. Please try again.';
              form.parentNode.insertBefore(err, form.nextSibling);
            }
          });
      });
    });
  }


  /* ═══════════════════════════════════════════════
     SHARE LINKS

     Client-side share URLs — no server needed.
     Twitter, LinkedIn, Facebook, WhatsApp use URL
     query params. The native Web Share API covers
     mobile (including Instagram sharing via the OS).
     ═══════════════════════════════════════════════ */

  function initShare() {
    var links = document.querySelectorAll('.share-link');
    if (!links.length) return;

    var pageUrl = encodeURIComponent(window.location.href);
    var pageTitle = encodeURIComponent(document.title);

    links.forEach(function (link) {
      var platform = link.getAttribute('data-platform');

      if (platform === 'native') {
        // Web Share API (mobile)
        if (navigator.share) {
          link.addEventListener('click', function (e) {
            e.preventDefault();
            navigator.share({
              title: document.title,
              url: window.location.href,
            });
          });
        } else {
          link.style.display = 'none';
        }
        return;
      }

      var urls = {
        twitter: 'https://twitter.com/intent/tweet?text=' + pageTitle + '&url=' + pageUrl,
        linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + pageUrl,
        facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + pageUrl,
        whatsapp: 'https://api.whatsapp.com/send?text=' + pageTitle + '%20' + pageUrl,
      };

      if (urls[platform]) {
        link.href = urls[platform];
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    });
  }


  /* ═══════════════════════════════════════════════
     THEME TOGGLE

     Toggles between light and dark themes. Persists
     choice to localStorage. System preference is the
     default (set in inline <head> script).
     ═══════════════════════════════════════════════ */

  function initThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';

      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);

      toggle.setAttribute('aria-label',
        next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
      );
    });

    // Set initial aria-label
    const current = document.documentElement.getAttribute('data-theme');
    toggle.setAttribute('aria-label',
      current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
    );
  }


  /* ═══════════════════════════════════════════════
     INIT
     ═══════════════════════════════════════════════ */

  document.addEventListener('DOMContentLoaded', () => {
    initWordmark();
    initWordmarkScroll();
    initScrollReveal();
    initNavScroll();
    initSmoothScroll();
    initShowMore();
    initSubscribe();
    initShare();
    initThemeToggle();
  });

})();
