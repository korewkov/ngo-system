const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const XAI_ENDPOINT = 'https://api.x.ai/v1/responses';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

function readPrompt(body) {
  const prompt = body?.prompt || body?.input || body?.text;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Передай prompt, input или text.');
  }
  return prompt.trim();
}

function buildGeminiBody(body, prompt) {
  return {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: Number(body?.temperature ?? 0.7),
      maxOutputTokens: Number(body?.maxOutputTokens ?? 1200)
    }
  };
}

function buildXaiBody(body, prompt) {
  return {
    model: body?.model || process.env.XAI_MODEL || 'grok-4.3',
    input: [
      {
        role: 'system',
        content: 'Ты полезный русскоязычный помощник для штаба НГО. Отвечай строго в формате, который просит пользователь.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: Number(body?.temperature ?? 0.7),
    max_output_tokens: Number(body?.maxOutputTokens ?? 1200)
  };
}

function buildOpenRouterBody(body, prompt) {
  return {
    model: body?.model || process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash:free',
    messages: [
      {
        role: 'system',
        content: 'Ты полезный русскоязычный помощник для штаба НГО. Отвечай строго в формате, который просит пользователь.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: Number(body?.temperature ?? 0.7),
    max_tokens: Number(body?.maxOutputTokens ?? 1200)
  };
}

function buildGroqBody(body, prompt) {
  return {
    model: body?.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'Ты полезный русскоязычный помощник для штаба НГО. Отвечай строго в формате, который просит пользователь.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: Number(body?.temperature ?? 0.7),
    max_completion_tokens: Number(body?.maxOutputTokens ?? 1200)
  };
}

function extractGeminiText(data) {
  return (data?.candidates || [])
    .flatMap(candidate => candidate?.content?.parts || [])
    .map(part => part?.text || '')
    .join('\n')
    .trim();
}

function extractXaiText(data) {
  if (typeof data?.output_text === 'string') return data.output_text.trim();
  return (data?.output || [])
    .flatMap(item => item?.content || [])
    .map(part => part?.text || part?.content || '')
    .join('\n')
    .trim();
}

function extractOpenRouterText(data) {
  return (data?.choices || [])
    .map(choice => choice?.message?.content || choice?.text || '')
    .join('\n')
    .trim();
}

function extractChatCompletionText(data) {
  return (data?.choices || [])
    .map(choice => choice?.message?.content || choice?.text || '')
    .join('\n')
    .trim();
}

function provider() {
  return (process.env.AI_PROVIDER || (process.env.GROQ_API_KEY ? 'groq' : process.env.OPENROUTER_API_KEY ? 'openrouter' : process.env.XAI_API_KEY ? 'xai' : 'gemini')).toLowerCase();
}

async function generateWithGemini(body, prompt) {
  if (!process.env.GEMINI_API_KEY) {
    return {
      status: 500,
      data: { error: 'На сервере не задан GEMINI_API_KEY.' }
    };
  }

  const model = body?.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY
    },
    body: JSON.stringify(buildGeminiBody(body, prompt))
  });
  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || 'Gemini вернул ошибку.';
    const userMessage = /location is not supported/i.test(message)
      ? 'Gemini API недоступен из текущего региона запуска. Код и ключ подключены, но Google отклонил запрос по location policy.'
      : message;
    return { status: response.status, data: { error: userMessage, details: data } };
  }

  return { status: 200, data: { text: extractGeminiText(data), model, provider: 'gemini', raw: data } };
}

async function generateWithXai(body, prompt) {
  if (!process.env.XAI_API_KEY) {
    return {
      status: 500,
      data: { error: 'На сервере не задан XAI_API_KEY. Бесплатный Grok в браузере не равен доступу к xAI API.' }
    };
  }

  const requestBody = buildXaiBody(body, prompt);
  const response = await fetch(XAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.XAI_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });
  const data = await response.json();

  if (!response.ok) {
    return {
      status: response.status,
      data: {
        error: data?.error?.message || data?.message || 'xAI/Grok вернул ошибку.',
        details: data
      }
    };
  }

  return {
    status: 200,
    data: {
      text: extractXaiText(data),
      model: requestBody.model,
      provider: 'xai',
      raw: data
    }
  };
}

async function callOpenRouter(requestBody) {
  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:8765',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'NGO System'
    },
    body: JSON.stringify(requestBody)
  });
  const data = await response.json();
  return { response, data };
}

async function generateWithOpenRouter(body, prompt) {
  if (!process.env.OPENROUTER_API_KEY) {
    return {
      status: 500,
      data: { error: 'На сервере не задан OPENROUTER_API_KEY.' }
    };
  }

  let requestBody = buildOpenRouterBody(body, prompt);
  let { response, data } = await callOpenRouter(requestBody);

  const shouldRetryFreeRouter = response.status === 429 && requestBody.model !== 'openrouter/free';
  if (shouldRetryFreeRouter) {
    requestBody = { ...requestBody, model: 'openrouter/free' };
    ({ response, data } = await callOpenRouter(requestBody));
  }

  if (!response.ok) {
    return {
      status: response.status,
      data: {
        error: data?.error?.message || data?.message || 'OpenRouter вернул ошибку.',
        fallbackTried: shouldRetryFreeRouter,
        details: data
      }
    };
  }

  return {
    status: 200,
    data: {
      text: extractOpenRouterText(data),
      model: requestBody.model,
      provider: 'openrouter',
      fallbackUsed: shouldRetryFreeRouter,
      raw: data
    }
  };
}

async function generateWithGroq(body, prompt) {
  if (!process.env.GROQ_API_KEY) {
    return {
      status: 500,
      data: { error: 'На сервере не задан GROQ_API_KEY.' }
    };
  }

  const requestBody = buildGroqBody(body, prompt);
  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });
  const data = await response.json();

  if (!response.ok) {
    return {
      status: response.status,
      data: {
        error: data?.error?.message || data?.message || 'Groq вернул ошибку.',
        details: data
      }
    };
  }

  return {
    status: 200,
    data: {
      text: extractChatCompletionText(data),
      model: requestBody.model,
      provider: 'groq',
      raw: data
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Метод не поддерживается. Используй POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const prompt = readPrompt(body);
    const selectedProvider = provider();
    const result = selectedProvider === 'groq'
      ? await generateWithGroq(body, prompt)
      : selectedProvider === 'openrouter'
      ? await generateWithOpenRouter(body, prompt)
      : selectedProvider === 'xai'
        ? await generateWithXai(body, prompt)
        : await generateWithGemini(body, prompt);
    return res.status(result.status).json(result.data);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Не удалось собрать запрос к AI-провайдеру.' });
  }
}
