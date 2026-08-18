// Flanagan marketing site — theme toggle, scroll choreography, deck shuffle.
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var motionOk = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

  // ---------------------------------------------------------------- theme --
  var toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var current = root.dataset.theme;
      if (!current) {
        current = window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark';
      }
      var next = current === 'light' ? 'dark' : 'light';
      root.dataset.theme = next;
      try {
        localStorage.setItem('flanagan-theme', next);
      } catch (e) {}
    });
  }

  // ------------------------------------------------------- headline words --
  // Split the hero headline into per-word masks so each word can rise on its
  // own. Runs before the reveal observer so the first paint is already split.
  if (motionOk) {
    document.querySelectorAll('[data-words]').forEach(function (el) {
      var words = el.textContent.split(' ');
      el.textContent = '';
      words.forEach(function (word, i) {
        var mask = document.createElement('span');
        mask.className = 'word';
        mask.style.setProperty('--w', i);
        var inner = document.createElement('span');
        inner.textContent = word;
        mask.appendChild(inner);
        el.appendChild(mask);
        if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      });
    });
  }

  // -------------------------------------------------------------- reveals --
  var revealed = document.querySelectorAll('[data-reveal]');

  if (motionOk && 'IntersectionObserver' in window && revealed.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );
    revealed.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    revealed.forEach(function (el) {
      el.classList.add('is-in');
    });
  }

  // ------------------------------------------------------------- parallax --
  // Elements marked data-parallax drift against the scroll: offset from the
  // viewport centre × factor, applied as --py. Transform-only, one rAF a
  // frame, and the element's own drift is subtracted before measuring so the
  // loop never feeds back.
  if (motionOk) {
    var drifters = [];
    document.querySelectorAll('[data-parallax]').forEach(function (el) {
      drifters.push({ el: el, f: parseFloat(el.dataset.parallax) || 0.06, py: 0 });
    });

    if (drifters.length) {
      var ticking = false;

      var applyDrift = function () {
        ticking = false;
        var mid = window.innerHeight / 2;
        drifters.forEach(function (d) {
          var r = d.el.getBoundingClientRect();
          if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
          var centre = r.top + r.height / 2 - d.py;
          var py = Math.round((mid - centre) * d.f * 10) / 10;
          if (py !== d.py) {
            d.py = py;
            d.el.style.setProperty('--py', py + 'px');
          }
        });
      };

      var queueDrift = function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(applyDrift);
        }
      };

      window.addEventListener('scroll', queueDrift, { passive: true });
      window.addEventListener('resize', queueDrift);
      queueDrift();
    }
  }

  // ------------------------------------------------------------- counters --
  // The one-bottle-away numerals count up when the ledger arrives.
  if (motionOk && 'IntersectionObserver' in window) {
    var countUp = function (el) {
      var target = parseInt(el.textContent, 10);
      if (!target) return;
      var start = null;
      var duration = 900;
      var step = function (now) {
        if (start === null) start = now;
        var p = Math.min(1, (now - start) / duration);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.max(1, Math.round(target * eased)));
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = String(target);
      };
      requestAnimationFrame(step);
    };

    var numerals = document.querySelectorAll('.ledger-card__numeral');
    if (numerals.length) {
      var counted = false;
      var counterObserver = new IntersectionObserver(
        function (entries) {
          if (counted || !entries.some(function (e) { return e.isIntersecting; })) return;
          counted = true;
          numerals.forEach(countUp);
          counterObserver.disconnect();
        },
        { threshold: 0.4 }
      );
      counterObserver.observe(numerals[0].closest('.ledger-card') || numerals[0]);
    }
  }

  // ---------------------------------------------------------------- story --
  // The pinned scene: as each chapter panel crosses the middle of the
  // viewport, the sticky phone turns to that chapter's screen. Runs under
  // reduced motion too — it's a content change; CSS decides whether it
  // animates.
  var storyPanels = document.querySelectorAll('.story__panel');
  var storyScreens = document.querySelectorAll('.story__media .story__screen');
  if (storyPanels.length && storyScreens.length && 'IntersectionObserver' in window) {
    var setScreen = function (key) {
      storyScreens.forEach(function (screen) {
        screen.classList.toggle('is-active', screen.dataset.screen === key);
      });
    };
    var storyObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setScreen(entry.target.dataset.screen);
        });
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: 0 }
    );
    storyPanels.forEach(function (panel) {
      storyObserver.observe(panel);
    });
  }

  // ----------------------------------------------------------------- deck --
  // The Tonight deck deals itself while it's on screen, echoing the app's
  // swipe — and a tap still deals the next card by hand.
  var deck = document.getElementById('deck');
  if (deck) {
    var deal = function () {
      var cards = deck.querySelectorAll('.deck__card');
      cards.forEach(function (card) {
        var pos = parseInt(card.dataset.pos, 10);
        card.dataset.pos = String((pos + cards.length - 1) % cards.length);
      });
    };

    deck.style.pointerEvents = 'auto';
    deck.style.cursor = 'pointer';
    deck.setAttribute('title', 'Deal the next card');
    deck.addEventListener('click', deal);

    if (motionOk && 'IntersectionObserver' in window) {
      var deckVisible = false;
      new IntersectionObserver(
        function (entries) {
          deckVisible = entries[0].isIntersecting;
        },
        { threshold: 0.5 }
      ).observe(deck);

      setInterval(function () {
        if (deckVisible && !document.hidden) deal();
      }, 3800);
    }
  }
})();
