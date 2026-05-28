# План подключения Supabase и Gemini

## Уже подготовлено

- `assets/ngo-core.js` подключен ко всем страницам и содержит общие утилиты:
  - `NgoCore.readJson/writeJson`;
  - `NgoCore.downloadFile`;
  - `NgoCore.copyText`;
  - `NgoCore.supabase`;
  - `NgoCore.ai.generateText`.
- `assets/ngo-shell.css` вынес системные стили из `ngo-system.js`.
- `api/generate.js` принимает запросы фронта и вызывает Gemini на сервере.
- `api/generate.js` также поддерживает xAI/Grok через `AI_PROVIDER=xai`, `XAI_API_KEY` и `XAI_MODEL`.
- `api/generate.js` также поддерживает OpenRouter через `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY` и `OPENROUTER_MODEL`.
- `api/generate.js` также поддерживает GroqCloud через `AI_PROVIDER=groq`, `GROQ_API_KEY` и `GROQ_MODEL`.
- `voice.html` использует `NgoCore.ai.generateText` для генерации 5 медиа-текстов и откатывается к шаблонам при ошибке.
- `letters.html` использует `NgoCore.ai.generateText` для AI-черновика основного текста письма и откатывается к шаблонной формулировке при ошибке.
- `partners.html` использует `NgoCore.ai.generateText` для персонализированного пакета партнёрства и откатывается к шаблонам при ошибке.
- `emergency.html` использует `NgoCore.ai.generateText` для оперативных сообщений, инструкций и кризисных текстов с безопасным fallback на шаблоны.
- `events.html` использует `NgoCore.ai.generateText` для сценария ведущего и откатывается к шаблонному сценарию при ошибке.

## Gemini

Фронт должен обращаться только так:

```js
const result = await NgoCore.ai.generateText({
  prompt: 'Собери пост для Telegram о событии...',
  temperature: 0.7,
  maxOutputTokens: 900
});
```

Серверная функция читает `GEMINI_API_KEY` из переменных окружения и отправляет запрос в Gemini `generateContent`. Это сохраняет ключ вне браузера.

Для локального теста используйте:

```bash
GEMINI_API_KEY=ваш_ключ npm run dev
```

Этот сервер обслуживает HTML и `/api/generate` в одном origin, поэтому поведение ближе к Vercel, чем при запуске через `python3 -m http.server`.

Порядок перевода сервисов на ИИ:

1. `voice.html` — готово: AI + fallback на шаблоны.
2. `letters.html` — готово: AI-черновик тела письма + fallback на шаблон.
3. `partners.html` — готово: AI-персонализация предложения + fallback на шаблоны.
4. `emergency.html` — готово: AI для оперативных текстов + fallback на шаблоны.
5. `events.html` — готово: AI-сценарий ведущего + fallback на шаблон.

## Supabase

Для фронта нужен публичный anon key. Его можно держать в конфиге страницы, но права должны ограничиваться RLS-политиками Supabase.

Минимальный конфиг:

```html
<script>
  window.NGO_CONFIG = {
    supabaseUrl: 'https://PROJECT.supabase.co',
    supabaseAnonKey: 'public-anon-key'
  };
</script>
<script src="assets/ngo-core.js"></script>
```

Рекомендуемые таблицы:

- `events` — события из `events.html`.
- `budgets` — сметы из `budget.html`.
- `brigades` — отряды из `pulse.html`.
- `partners` — база партнеров.
- `letters` — черновики писем.
- `ai_generations` — история AI-запросов, если понадобится аудит.

## Следующий технический шаг

Переводить сервисы по одному. Следующий кандидат — `events.html`, потому что он может использовать AI для сценария ведущего, описания события и программных блоков, но структурные данные события лучше сохранять контролируемо, без полной замены логики формы.
