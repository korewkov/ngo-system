# Пульт НГО

Локальная статическая система для работы штаба НГО: события, сметы, тексты, партнёрства, письма, аварийные сценарии и пульт навигации.

## Структура

- `index.html` — главный пульт и карта задач.
- `pulse.html` — отряды, связи и касания.
- `events.html` — события, программа, сценарий и пакет события.
- `budget.html` — сметы и оргвзнос.
- `voice.html` — тексты для медиа и чатов.
- `partners.html` — партнёрские предложения.
- `emergency.html` — оперативные сообщения и чек-листы.
- `letters.html` — официальные письма.
- `assets/ngo-core.js` — общие утилиты, будущий клиент Supabase и клиент вызова AI-прослойки.
- `assets/ngo-system.js` — общий слой данных, активное событие и системная навигация.
- `assets/ngo-shell.css` — стили общей системной панели и нижней навигации.
- `api/generate.js` — серверная функция для AI-провайдера. API-ключ хранится только в переменных окружения.
- `ARCHITECTURE_AUDIT.md` — аудит текущей архитектуры и план перехода к Supabase/Gemini.

## Деплой на Vercel

Проект статический и не требует сборки. Подключите GitHub-репозиторий к Vercel как обычный static project:

- Framework Preset: `Other`
- Build Command: пусто
- Output Directory: пусто или `.`

После подключения каждый push в GitHub будет автоматически обновлять сайт.

## Переменные окружения

Для Gemini на Vercel добавьте:

- `AI_PROVIDER=gemini`
- `GEMINI_API_KEY` — секретный ключ Gemini API.
- `GEMINI_MODEL` — модель, по умолчанию `gemini-2.5-flash`.

Для xAI/Grok:

- `AI_PROVIDER=xai`
- `XAI_API_KEY` — секретный ключ xAI API.
- `XAI_MODEL` — модель, по умолчанию `grok-4.3`.

Для OpenRouter:

- `AI_PROVIDER=openrouter`
- `OPENROUTER_API_KEY` — секретный ключ OpenRouter.
- `OPENROUTER_MODEL` — модель, например `deepseek/deepseek-v4-flash:free`.
- `OPENROUTER_SITE_URL` и `OPENROUTER_APP_NAME` — необязательные метаданные для OpenRouter.

Если выбранная free-модель OpenRouter временно отдаёт `429`, сервер пробует резервный роутер `openrouter/free`.

Для GroqCloud:

- `AI_PROVIDER=groq`
- `GROQ_API_KEY` — секретный ключ GroqCloud.
- `GROQ_MODEL` — модель, например `llama-3.3-70b-versatile`.

Пример есть в `.env.example`. Не добавляйте реальные ключи в HTML, JS или git.

## Локальная проверка Gemini

Обычный `python3 -m http.server` подходит для просмотра HTML, но не умеет обрабатывать `/api/generate`.
Для проверки AI-запросов используйте локальный Node-сервер:

```bash
GEMINI_API_KEY=ваш_ключ npm run dev
```

Или создайте локальный `.env` рядом с `.env.example`:

```bash
GEMINI_API_KEY=ваш_ключ
GEMINI_MODEL=gemini-2.5-flash
```

Для xAI/Grok:

```bash
AI_PROVIDER=xai
XAI_API_KEY=ваш_ключ
XAI_MODEL=grok-4.3
```

Для OpenRouter:

```bash
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=ваш_ключ
OPENROUTER_MODEL=deepseek/deepseek-v4-flash:free
OPENROUTER_SITE_URL=http://localhost:8765
OPENROUTER_APP_NAME=NGO System
```

Для GroqCloud:

```bash
AI_PROVIDER=groq
GROQ_API_KEY=ваш_ключ
GROQ_MODEL=llama-3.3-70b-versatile
```

После этого достаточно запускать:

```bash
npm run dev
```

После запуска откройте `http://localhost:8765`. Если ключ не задан, сервисы не ломаются и используют шаблонный fallback.
