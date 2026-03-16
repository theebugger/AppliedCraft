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

  /* ── Shared diffusion animation ──
     Runs the exact same A-I seed → noise → resolve
     sequence on any array of .wm-letter elements.
     Calls onComplete when all 7 letters have locked in. */

  function runDiffusion(letters, onComplete) {
    var resolved = new Set();
    var noiseInterval = null;

    // Per-letter resolve times (ms after noise starts)
    // Used to compute opacity progression — letters near
    // the seeds darken faster than distant ones.
    var letterResolveTimes = {};
    RESOLVE_SCHEDULE.forEach(function (item) {
      letterResolveTimes[item.index] = item.time;
    });

    // Phase 1: Show seed letters (A and I)
    setTimeout(function () {
      SEED_INDICES.forEach(function (i) {
        letters[i].textContent = WORD[i];
        letters[i].className = 'wm-letter seed';
        resolved.add(i);
      });
    }, 300);

    // Phase 2: Start noise (~250ms after seeds)
    // Each letter has its own cycle speed and opacity, both
    // progressing based on proximity to its resolve time.
    // Speed: 80ms (slow, exploratory) → 25ms (rapid convergence)
    // Opacity: 0.12 (faint) → 0.65 (near-solid)
    // The acceleration mirrors diffusion model confidence.
    var noiseStartedAt;
    setTimeout(function () {
      noiseStartedAt = Date.now();
      var lastUpdate = {};

      noiseInterval = setInterval(function () {
        var now = Date.now();
        var elapsed = now - noiseStartedAt;

        for (var i = 0; i < letters.length; i++) {
          if (resolved.has(i)) continue;

          var rt = letterResolveTimes[i] || 1450;
          var progress = Math.min(elapsed / rt, 1);

          // Cubic easing — stays slow for first half, ramps sharply
          // at 50%: eased=0.125 (barely moved)
          // at 75%: eased=0.42 (starting to accelerate)
          // at 90%: eased=0.73 (fast)
          var eased = progress * progress * progress;

          // Per-letter cycle speed: 100ms → 18ms
          var cycleMs = 100 - eased * 82;

          if (!lastUpdate[i] || (now - lastUpdate[i]) >= cycleMs) {
            var charSet = resolved.size < 4 ? NOISE_CHARS : CHARS;
            letters[i].textContent = charSet[Math.floor(Math.random() * charSet.length)];
            letters[i].className = 'wm-letter noise';
            // Opacity also eased — stays faint longer, darkens rapidly
            letters[i].style.opacity = (0.10 + eased * 0.58).toFixed(2);
            lastUpdate[i] = now;
          }
        }
      }, 20); // Master loop at 20ms — per-letter timing gates the actual updates
    }, 550);

    // Phase 3: Resolve letters according to schedule
    var noiseStartTime = 550;

    RESOLVE_SCHEDULE.forEach(function (item) {
      var decelStart = noiseStartTime + item.time - 350;
      var resolveTime = noiseStartTime + item.time;

      // Deceleration — bump opacity near final
      setTimeout(function () {
        if (letters[item.index]) {
          letters[item.index].classList.remove('noise');
          letters[item.index].classList.add('resolving');
          letters[item.index].style.opacity = '0.75';
        }
      }, decelStart);

      var decelCount = 0;
      var decelInterval = setInterval(function () {
        if (letters[item.index] && !resolved.has(item.index)) {
          letters[item.index].textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
          decelCount++;
        }
        if (decelCount >= 3) clearInterval(decelInterval);
      }, 100);

      // Lock in — clear inline opacity, let .resolved class take over
      setTimeout(function () {
        clearInterval(decelInterval);
        if (letters[item.index]) {
          letters[item.index].textContent = WORD[item.index];
          letters[item.index].style.opacity = '';
          letters[item.index].classList.remove('noise', 'resolving');
          letters[item.index].classList.add('resolved');
          resolved.add(item.index);
        }

        if (resolved.size === WORD.length) {
          clearInterval(noiseInterval);
          if (onComplete) onComplete();
        }
      }, resolveTime);
    });
  }


  /* ── Sequential CRAFT letter reveal ── */

  function revealCraftLetters(craftEl) {
    var letters = craftEl.querySelectorAll('.craft-letter');
    letters.forEach(function (letter, i) {
      setTimeout(function () {
        letter.classList.add('visible');
      }, 50 * i);
    });
  }


  /* ── Hero wordmark (page load) ── */

  function initWordmark() {
    var container = document.getElementById('wordmark-applied');
    var craftEl = document.getElementById('wordmark-craft');
    var taglineEl = document.getElementById('hero-tagline');
    var ctaEl = document.getElementById('hero-cta');

    if (!container) return;

    var letters = Array.from(container.querySelectorAll('.wm-letter'));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      letters.forEach(function (el, i) {
        el.textContent = WORD[i];
        el.classList.add('resolved');
      });
      craftEl.classList.add('visible');
      craftEl.querySelectorAll('.craft-letter').forEach(function (l) { l.classList.add('visible'); });
      taglineEl.classList.add('visible');
      ctaEl.classList.add('visible');
      heroReady = true;
      return;
    }

    runDiffusion(letters, function () {
      setTimeout(function () {
        craftEl.classList.add('visible');
        revealCraftLetters(craftEl);
      }, 400);
      setTimeout(function () { taglineEl.classList.add('visible'); }, 900);
      setTimeout(function () { ctaEl.classList.add('visible'); heroReady = true; }, 1300);
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
     NAV WORDMARK CLICK — DIFFUSION + NAVIGATE

     Tapping the nav wordmark runs the exact same
     diffusion animation as the hero (same code via
     runDiffusion), while simultaneously scrolling
     to #about. The user's attention is on the
     animation; the page moves underneath.
     ═══════════════════════════════════════════════ */

  function initNavWordmarkClick() {
    var link = document.querySelector('.nav-wordmark');
    if (!link) return;

    var navApplied = link.querySelector('.nav-wm-applied');
    var navCraft = link.querySelector('.nav-wm-craft');
    if (!navApplied || !navCraft) return;

    var navLetters = Array.from(navApplied.querySelectorAll('.wm-letter'));
    var animating = false;

    link.addEventListener('click', function (e) {
      e.preventDefault();
      if (animating) return;
      animating = true;

      // A and I stay visible — set them to seed immediately
      SEED_INDICES.forEach(function (i) {
        navLetters[i].textContent = WORD[i];
        navLetters[i].className = 'wm-letter seed';
      });

      // Other letters fade out smoothly (same window as hero seed phase)
      navLetters.forEach(function (el, i) {
        if (!SEED_INDICES.has(i)) {
          el.style.transition = 'opacity 0.25s ease';
          el.style.opacity = '0';
        }
      });

      // After fade, clear non-seed text and reset to default state
      setTimeout(function () {
        navLetters.forEach(function (el, i) {
          if (!SEED_INDICES.has(i)) {
            el.textContent = '';
            el.style.transition = '';
            el.style.opacity = '';
            el.className = 'wm-letter';
          }
        });
      }, 250);

      // Hide CRAFT letters
      var navCraftLetters = navCraft.querySelectorAll('.craft-letter');
      navCraftLetters.forEach(function (el) {
        el.classList.remove('nav-wm-static', 'visible');
      });

      // Start scroll immediately — in parallel with animation
      var aboutEl = document.querySelector('#about');
      if (aboutEl) {
        var navHeight = document.querySelector('.nav').offsetHeight || 0;
        var pos = aboutEl.getBoundingClientRect().top + window.scrollY - navHeight + 80;
        window.scrollTo({ top: pos, behavior: 'smooth' });
      }

      // Run the exact same diffusion animation
      runDiffusion(navLetters, function () {
        // CRAFT letters reveal sequentially (same 400ms delay as hero)
        setTimeout(function () {
          revealCraftLetters(navCraft);
        }, 400);

        // Restore static state after CRAFT appears
        setTimeout(function () {
          animating = false;
          navLetters.forEach(function (el) {
            el.className = 'wm-letter nav-wm-static';
          });
          navCraftLetters.forEach(function (el) {
            el.classList.add('nav-wm-static');
          });

          // If on another page, navigate after animation
          if (!aboutEl) {
            window.location.href = link.href;
          }
        }, 900);
      });
    });
  }


  /* ═══════════════════════════════════════════════
     DYNAMIC POST LOADING

     Fetches posts/posts.json, filters published,
     renders post cards, and manages show-more.
     ═══════════════════════════════════════════════ */

  var INITIAL_POSTS = 3;

  function initPosts() {
    var container = document.getElementById('posts-container');
    if (!container) return;

    fetch('posts/posts.json')
      .then(function (r) { return r.json(); })
      .then(function (posts) {
        var published = posts
          .filter(function (p) { return p.status === 'published'; })
          .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

        published.forEach(function (post, i) {
          var card = document.createElement('article');
          card.className = 'post-card' + (i >= INITIAL_POSTS ? ' post-card--hidden' : '');
          card.innerHTML =
            '<time class="post-date" datetime="' + post.date + '">' + formatDateShort(post.date) + '</time>' +
            '<h3 class="post-title"><a href="posts/' + post.slug + '.html">' + escHTML(post.title) + '</a></h3>' +
            '<p class="post-excerpt">' + escHTML(post.excerpt) + '</p>' +
            '<span class="post-meta">' + post.readTime + '</span>';
          container.appendChild(card);
        });

        // Reveal visible cards with stagger
        var visible = container.querySelectorAll('.post-card:not(.post-card--hidden)');
        visible.forEach(function (card, i) {
          card.classList.add('reveal');
          setTimeout(function () { card.classList.add('visible'); }, 120 * (i + 1));
        });

        // Show "more" button if needed
        if (published.length > INITIAL_POSTS) {
          var moreEl = document.getElementById('posts-more');
          if (moreEl) moreEl.style.display = '';
        }
      })
      .catch(function () {
        // Fallback: show nothing (posts.json may not exist in local dev)
      });
  }

  function initShowMore() {
    var btn = document.getElementById('posts-show-more');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var hidden = document.querySelectorAll('.post-card--hidden');
      if (!hidden.length) return;

      hidden.forEach(function (card) {
        card.classList.remove('post-card--hidden');
        card.classList.add('reveal');
      });

      hidden.forEach(function (card, i) {
        setTimeout(function () {
          card.classList.add('visible');
        }, 120 * (i + 1));
      });

      setTimeout(function () {
        btn.style.display = 'none';
      }, 120 * (hidden.length + 1));
    });
  }

  function formatDateShort(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T00:00:00');
    var m = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return m[d.getMonth()] + ' ' + d.getFullYear();
  }

  function escHTML(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
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
    initNavWordmarkClick();
    initPosts();
    initScrollReveal();
    initNavScroll();
    initSmoothScroll();
    initShowMore();
    initSubscribe();
    initShare();
    initThemeToggle();
  });

})();
