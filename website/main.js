// Flanagan marketing site — theme toggle, scroll reveals, deck shuffle.
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

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

  // -------------------------------------------------------------- reveals --
  var revealed = document.querySelectorAll('[data-reveal]');
  var motionOk = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

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
      { threshold: 0.15, rootMargin: '0px 0px -5% 0px' }
    );
    revealed.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    revealed.forEach(function (el) {
      el.classList.add('is-in');
    });
  }

  // ----------------------------------------------------------------- deck --
  // Tap the Tonight deck to deal the next card, echoing the app's swipe.
  var deck = document.getElementById('deck');
  if (deck) {
    deck.style.pointerEvents = 'auto';
    deck.style.cursor = 'pointer';
    deck.setAttribute('title', 'Deal the next card');
    deck.addEventListener('click', function () {
      var cards = deck.querySelectorAll('.deck__card');
      cards.forEach(function (card) {
        var pos = parseInt(card.dataset.pos, 10);
        card.dataset.pos = String((pos + cards.length - 1) % cards.length);
      });
    });
  }
})();
