# Точка.чат

Абсолютно бесплатный корпоративный мессенджер для Windows: без подписок, лицензий и ограничений по числу пользователей. Клиент распространяется готовым `.exe` из [Releases](https://github.com/san4jkee/tochka.chat/releases), серверная часть — в этом репозитории.

**Стек**: Node.js · Express · PostgreSQL (knex) · Socket.IO · LDAP (ldapjs) · JWT

## Возможности

- Каналы (публичные/приватные), личные сообщения, закрепление и мут каналов
- Сообщения: текст, файлы, изображения (обработка через sharp), опросы
- Реакции, ответы, пересылка, поиск по сообщениям
- Галочки прочтения (одна/двойная) в реальном времени
- Аутентификация через Active Directory (LDAP) с fallback на локальную базу
- Десктопные уведомления и индикатор набора
- Автообновление клиента: раздача файлов обновлений (.exe + latest.yml) с сервера

## Структура репозитория

```
├── server/         # Серверная часть (Node.js + PostgreSQL)
└── Releases        # Готовый установщик клиента (.exe)
```

## Требования

- **Node.js** 18+
- **PostgreSQL** 14+

## Установка сервера

### 1. PostgreSQL

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# CentOS / RHEL
sudo dnf install postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
```

### 2. Создание базы данных

```bash
sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";"
sudo -u postgres psql -c "CREATE DATABASE messenger;"
sudo -u postgres psql -c "CREATE USER messenger_user WITH PASSWORD 'your_secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE messenger TO messenger_user;"
sudo -u postgres psql -d messenger -c "GRANT ALL ON SCHEMA public TO messenger_user;"
```

### 3. Установка зависимостей и настройка окружения

```bash
cd server
npm install
cp .env.example .env
```

Отредактируйте `.env` (см. [Конфигурация](#конфигурация)).

### 4. Запуск миграций

```bash
npm run migrate
```

Миграции создадут все таблицы: пользователи, каналы, участники, сообщения, реакции, опросы, галочки прочтения.

### 5. Подготовка каталогов

Каталог для загрузок и файлов обновлений создаётся автоматически при старте сервера. Если нужна ручная подготовка:

```bash
mkdir -p uploads updates
```

### 6. Запуск

```bash
# Разработка (hot-reload через nodemon)
npm run dev

# Продакшн
npm start
```

Сервер запустится на `http://localhost:3001`.

### 7. Управление через pm2

```bash
pm2 start "npm start" --name messenger
pm2 restart messenger
pm2 logs messenger
# автозапуск после перезагрузки ОС
pm2 startup
pm2 save
```

## Установка клиента

1. Скачайте последний `.exe` из раздела [Releases](https://github.com/)
2. Установите приложение на компьютер с Windows
3. При входе укажите адрес вашего сервера (иконка настроек на странице входа)

Клиент автоматически проверяет обновления и получает новые версии с вашего сервера.

## Конфигурация

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `PORT` | Порт HTTP-сервера | `3001` |
| `PG_HOST` | Хост PostgreSQL | `localhost` |
| `PG_PORT` | Порт PostgreSQL | `5432` |
| `PG_USER` | Пользователь БД | `postgres` |
| `PG_PASSWORD` | Пароль пользователя БД | — |
| `PG_DATABASE` | Имя базы данных | `messenger` |
| `JWT_SECRET` | Секрет подписи JWT-токенов | — |
| `LDAP_URL` | URL LDAP/AD сервера | `ldap://your-ad-server:389` |
| `LDAP_BIND_DN` | DN сервисного аккаунта | — |
| `LDAP_BIND_PASSWORD` | Пароль сервисного аккаунта | — |
| `LDAP_SEARCH_BASE` | База поиска пользователей | `DC=example,DC=com` |
| `LDAP_SEARCH_FILTER` | Фильтр поиска (`{{username}}` — логин) | `(sAMAccountName={{username}})` |
| `LDAP_TLS_REJECT_UNAUTHORIZED` | Проверять TLS-сертификат LDAP | `true` |
| `UPDATE_SECRET` | Секрет загрузки файлов обновлений | — |

> Без параметров LDAP сервер работает в режиме локальной регистрации: пользователи создаются в собственной базе, пароли хэшируются через bcrypt.

## Команды npm (server/)

| Команда | Описание |
|---------|----------|
| `npm start` | Запуск в продакшн |
| `npm run dev` | Запуск с hot-reload (nodemon) |
| `npm run migrate` | Применить миграции |
| `npm run migrate:rollback` | Откатить последнюю миграцию |
| `npm run migrate:make <name>` | Создать новую миграцию |

## Структура проекта

```
server/
├── src/
│   ├── index.js               # Точка входа (Express + Socket.IO)
│   ├── config.js              # Конфигурация из переменных окружения
│   ├── auth/
│   │   └── ldap.js            # LDAP/Active Directory аутентификация
│   ├── db/
│   │   ├── index.js           # Подключение к PostgreSQL (knex)
│   │   ├── mappers.js         # Маппинг БД → ответы API
│   │   ├── migrations/        # knex миграции
│   │   ├── queries/           # Запросы к БД
│   │   └── seed.js            # Сид-данные
│   ├── routes/
│   │   ├── auth.js            # Вход, регистрация, профиль, статусы
│   │   ├── channels.js        # Каналы и участники
│   │   ├── messages.js        # Сообщения, реакции, опросы, поиск
│   │   ├── files.js           # Загрузка и обработка файлов
│   │   └── updates.js         # Раздача файлов обновлений клиента
│   ├── socket/                # WebSocket-обработчики Socket.IO
│   └── middleware/
│       └── auth.js            # Проверка JWT
├── knexfile.js                # Конфигурация knex
├── .env.example               # Шаблон переменных окружения
└── package.json
```

## Аутентификация (LDAP / Active Directory)

При входе сервер:

1. Подключается к LDAP сервисным аккаунтом
2. Ищет пользователя по `sAMAccountName`
3. Проверяет пароль через bind с DN найденного пользователя
4. При ошибке AD — fallback на локальную базу (bcrypt)

## Лицензия

[MIT](/LICENSE)
