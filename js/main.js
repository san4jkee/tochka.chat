(function () {
  'use strict';

  var GITHUB_REPO = 'https://github.com/san4jkee/tochka.chat';
  var GITHUB_RELEASES = GITHUB_REPO + '/releases/latest';

  document.querySelectorAll('.js-repo').forEach(function (a) { a.href = GITHUB_REPO; });
  document.querySelectorAll('.js-release').forEach(function (a) { a.href = GITHUB_RELEASES; });

  var nav = document.getElementById('nav');
  var burger = document.getElementById('burger');
  var navLinks = document.querySelector('.nav__links');
  var navWrap = document.getElementById('setupNav');

  function initSetup() {
    var steps = Array.prototype.slice.call(document.querySelectorAll('.setup__step'));
    if (!navWrap || !steps.length) return;

    navWrap.addEventListener('click', function (e) {
      var t = e.target.closest('.setup__tab');
      if (!t) return;
      var i = +t.dataset.step;
      navWrap.querySelectorAll('.setup__tab').forEach(function (tab) {
        tab.classList.toggle('is-active', tab === t);
      });
      steps.forEach(function (step) {
        step.classList.toggle('is-active', +step.dataset.step === i);
      });
    });
  }

  function bindCopy(root) {
    root = root || document;
    root.querySelectorAll('.copy').forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var code = btn.closest('.code');
        var src = code && code.dataset.code ? code.dataset.code : code.querySelector('code').textContent;
        var done = function () {
          var old = btn.textContent;
          btn.textContent = 'Скопировано ✓';
          btn.classList.add('is-copied');
          setTimeout(function () { btn.textContent = old; btn.classList.remove('is-copied'); }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(src).then(done, function () { fallbackCopy(src); done(); });
        } else {
          fallbackCopy(src);
          done();
        }
      });
    });
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* Navbar scroll state */
  function onScroll() {
    if (window.scrollY > 20) nav.classList.add('is-scrolled');
    else nav.classList.remove('is-scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Burger menu */
  burger.addEventListener('click', function () {
    var open = navLinks.classList.toggle('is-open');
    burger.classList.toggle('is-open', open);
    navLinks.style.display = open ? 'flex' : '';
  });
  navLinks.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      navLinks.classList.remove('is-open');
      burger.classList.remove('is-open');
      navLinks.style.display = '';
    });
  });

  /* Reveal on scroll */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  initSetup();
  bindCopy(document);
})();
