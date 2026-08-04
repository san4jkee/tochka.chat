(function () {
  'use strict';

  var GITHUB_REPO = 'https://github.com/your-org/tochka-chat';
  var GITHUB_RELEASES = GITHUB_REPO + '/releases/latest';

  document.querySelectorAll('.js-repo').forEach(function (a) { a.href = GITHUB_REPO; });
  document.querySelectorAll('.js-release').forEach(function (a) { a.href = GITHUB_RELEASES; });

  var STEPS = [
    {
      title: 'Установка PostgreSQL и создание базы данных',
      intro: 'Настройте PostgreSQL и создайте базу, пользователя и расширение pgcrypto.',
      code: 'sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS \\"pgcrypto\\";"\nsudo -u postgres psql -c "CREATE DATABASE messenger;"\nsudo -u postgres psql -c "CREATE USER messenger_user WITH PASSWORD \'your_secure_password\';"\nsudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE messenger TO messenger_user;"\nsudo -u postgres psql -d messenger -c "GRANT ALL ON SCHEMA public TO messenger_user;"',
      shell: 'Ubuntu / Debian: sudo apt install postgresql postgresql-contrib',
      hint: 'На CentOS/RHEL дополнительно выполните: sudo dnf install postgresql-server postgresql-contrib && sudo postgresql-setup --initdb'
    },
    {
      title: 'Установка зависимостей и файл окружения',
      intro: 'Перейдите в папку сервера, установите зависимости и создайте файл .env из шаблона.',
      code: 'cd server\nnpm install\ncp .env.example .env',
      hint: 'Отредактируйте .env: укажите доступы к PostgreSQL, JWT_SECRET и опционально параметры LDAP/Active Directory.'
    },
    {
      title: 'Запуск миграций',
      intro: 'Миграции создадут все необходимые таблицы: пользователей, каналы, сообщения, реакции, опросы и галочки прочтения.',
      code: 'npm run migrate',
      hint: 'Миграции работают через knex. Перед первым запуском убедитесь, что пользователь PostgreSQL имеет права на схему public.'
    },
    {
      title: 'Запуск сервера',
      intro: 'Для разработки используйте nodemon с горячей перезагрузкой, для продакшена — обычный старт.',
      code: 'npm run dev      # разработка (hot-reload)\nnpm start         # продакшн',
      hint: 'Сервер будет доступен на http://localhost:3001. Откройте этот адрес в браузере и укажите его в клиенте.'
    },
    {
      title: 'Управление сервером через pm2',
      intro: 'pm2 держит процесс в живых, перезапускает при сбоях и показывает логи.',
      code: 'pm2 start "npm start" --name messenger\npm2 restart messenger\npm2 logs messenger',
      hint: 'Полезно добавить pm2-startup и pm2-save, чтобы сервер поднимался автоматически после перезагрузки.'
    },
    {
      title: 'Установка клиента (релиз)',
      intro: 'Исходный код клиента не публикуется — приложение распространяется готовым установщиком из GitHub Releases.',
      code: '# 1. Откройте раздел Releases репозитория на GitHub\n# 2. Скачайте последний .exe и установите его\n# 3. При входе укажите адрес сервера:\n#    http://server-ip:3001',
      hint: 'Адрес сервера хранится локально на каждом компьютере и меняется на странице входа (иконка настроек). Обновления доставляются автоматически с вашего сервера.'
    }
  ];

  var nav = document.getElementById('nav');
  var burger = document.getElementById('burger');
  var navLinks = document.querySelector('.nav__links');
  var panel = document.getElementById('setupPanel');
  var navWrap = document.getElementById('setupNav');

  function renderSteps() {
    if (!panel) return;
    var current = 0;
    panel.innerHTML = '';
    navWrap.innerHTML = '';

    STEPS.forEach(function (s, i) {
      var tab = document.createElement('button');
      tab.className = 'setup__tab' + (i === 0 ? ' is-active' : '');
      tab.type = 'button';
      tab.dataset.step = i;
      tab.textContent = (i + 1) + ' · ' + s.title.split(' — ')[0];
      navWrap.appendChild(tab);
    });

    function show(i) {
      current = i;
      var s = STEPS[i];
      var prev = s.intro ? '<p>' + s.intro + '</p>' : '';
      var codeHtml =
        '<div class="code">' +
          '<div class="code__head"><span>шаг ' + (i + 1) + '</span><button class="copy" type="button">Копировать</button></div>' +
          '<pre><code>' + escapeHtml(s.code) + '</code></pre>' +
        '</div>';
      var hint = s.hint ? '<p>' + s.hint + '</p>' : '';
      panel.innerHTML =
        '<h4>' + s.title + '</h4>' + prev + codeHtml + hint;
      bindCopy(panel);
      document.querySelectorAll('.setup__tab').forEach(function (t, k) {
        t.classList.toggle('is-active', k === i);
      });
    }

    navWrap.addEventListener('click', function (e) {
      var t = e.target.closest('.setup__tab');
      if (t) show(+t.dataset.step);
    });

    show(0);
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
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

  renderSteps();
  bindCopy(document);
})();
