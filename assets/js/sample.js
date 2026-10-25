/* Film controls, the drawn line, and the word reveal. */
(function () {
  'use strict';

  var video = document.querySelector('.hero-film');
  var openingStill = document.querySelector('.opening-still');
  var openingReleased = false;
  var soundToggle = document.getElementById('sound-toggle');
  var soundState = document.getElementById('sound-state');
  var soundIcon = document.querySelector('.sound-icon');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- sound: opt-in, with an icon that matches the state --- */
  function updateSound() {
    if (!video || !soundState || !soundToggle) return;
    soundState.textContent = video.muted ? 'Sound off' : 'Sound on';
    soundToggle.setAttribute('aria-pressed', String(!video.muted));
    soundToggle.setAttribute('aria-label', video.muted ? 'Turn sound on' : 'Turn sound off');
    if (soundIcon) soundIcon.innerHTML = video.muted
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m17 9 4 6m0-6-4 6"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13"/></svg>';
  }
  if (soundToggle && video) {
    soundToggle.addEventListener('click', function () {
      video.muted = !video.muted;
      updateSound();
    });
    updateSound();
  }

  /* --- the film only runs while it is on screen and the tab is visible --- */
  var FILM_W = 1920, FILM_H = 1080;
  var FILM_AR = FILM_W / FILM_H;
  /* Offset (in source pixels) of the stroke at the start of the drawing. */
  var START_OFFSET = 350;
  /* How far the phone crop travels, as a share of the film's displayed width. */
  var PHONE_TRAVEL = 0.14;

  /* Position the film and its cover so the stroke starts at the viewport's left edge. */
  function placeHero() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    /* The film is drawn to fit the viewport height, so its width is vh * FILM_AR. */
    var dispW = Math.round(vh * FILM_AR);
    if (dispW <= vw) return; /* film fits: no sliding needed */
    var raw = (dispW - vw) / 2 - (START_OFFSET * (dispW / FILM_W) - vw / 2);
    var min = 0, max = dispW - vw;
    var clamped = Math.max(min, Math.min(max, raw));
    var pct = clamped / (dispW - vw) * 100;
    var pos = pct.toFixed(2) + '% 50%';
    if (video) video.style.objectPosition = pos;
    if (openingStill) openingStill.style.objectPosition = pos;
  }
  function alignMobileFrame() {
    if (!video || !window.matchMedia('(max-width: 767px)').matches) return;
    /* The stroke starts left; follow it gently toward the eye at the frame's centre. */
    var progress = Math.max(0, Math.min(1, (video.currentTime - 2.8) / 8));
    var start = 42.5;
    var position = (start + PHONE_TRAVEL * 100 * progress).toFixed(1) + '% 50%';
    video.style.objectPosition = position;
    if (openingStill) openingStill.style.objectPosition = position;
  }
  function playIfVisible() {
    if (!video || reducedMotion) return;
    if (document.hidden) return;
    var r = video.getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight) video.play().catch(function () {});
  }
  function pauseIfHidden() {
    if (!video) return;
    var r = video.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= window.innerHeight) video.pause();
  }
  if (video) {
    if (!reducedMotion) {
      video.addEventListener('timeupdate', function () {
        alignMobileFrame();
        /* Keep the first frame of the film visible until its black-to-paper fade finishes. */
        if (!openingReleased && openingStill && video.currentTime >= 2.8) {
          openingStill.classList.add('is-released');
          openingReleased = true;
        }
      });
      alignMobileFrame();
      placeHero();
    }
    window.addEventListener('resize', function () {
      if (reducedMotion) return;
      placeHero();
      alignMobileFrame();
    });
    if (reducedMotion) {
      /* Honour the preference while showing the film's chosen still, never its black lead-in. */
      document.documentElement.classList.add('reduce-motion');
      video.removeAttribute('autoplay');
      video.pause();
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) playIfVisible(); else video.pause();
        });
      }, { threshold: 0.05 }).observe(video);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) video.pause(); else playIfVisible();
    });
  }

  /* --- the film's line draws itself, then the words arrive --- */
  var rules = document.querySelectorAll('.rule');
  function drawRules() {
    rules.forEach(function (rule) { rule.classList.add('on'); });
  }
  /* Each rule is a real path, so measure it and draw it from its own length. */
  rules.forEach(function (rule) {
    var path = rule.querySelector('.rule-path');
    if (!path) return;
    try {
      var length = Math.ceil(path.getTotalLength());
      path.style.strokeDasharray = length;
      path.style.strokeDashoffset = reducedMotion ? 0 : length;
    } catch (e) { /* path not ready; the CSS default still draws it */ }
  });
  if (reducedMotion) {
    drawRules();
  } else if (rules.length && 'IntersectionObserver' in window) {
    var ruleObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('on'); ruleObserver.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    rules.forEach(function (rule) { ruleObserver.observe(rule); });
  } else {
    drawRules();
  }

  /* --- the direction headline, one word at a time, keeping its line breaks --- */
  var headline = document.querySelector('.reveal-words');
  if (headline) {
    var children = Array.prototype.slice.call(headline.childNodes);
    var delay = 0;
    headline.textContent = '';
    children.forEach(function (child) {
      if (child.nodeType === 1 && child.nodeName === 'BR') {
        headline.appendChild(document.createElement('br'));
        return;
      }
      child.textContent.split(/\s+/).filter(Boolean).forEach(function (word, index, words) {
        var span = document.createElement('span');
        span.className = 'word';
        span.textContent = word;
        span.style.transitionDelay = (delay * 60) + 'ms';
        headline.appendChild(span);
        delay += 1;
        if (index < words.length - 1) headline.appendChild(document.createTextNode(' '));
      });
    });
    var wordSpans = headline.querySelectorAll('.word');
    function revealWords() { wordSpans.forEach(function (word) { word.classList.add('on'); }); }
    if (reducedMotion) revealWords();
    else if ('IntersectionObserver' in window) {
      var wordObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { revealWords(); wordObserver.disconnect(); }
        });
      }, { threshold: 0.25 });
      wordObserver.observe(headline);
    } else revealWords();
  }
})();
