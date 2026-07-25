const GEMINI_API_KEY_STORAGE_KEY = 'dubbiovi_gemini_api_key';
const OPENAI_API_KEY_STORAGE_KEY = 'dubbiovi_openai_api_key';
const DEEPL_API_KEY_STORAGE_KEY = 'dubbiovi_deepl_api_key';

export function loadApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to load API key from localStorage:', error);
    return null;
  }
}

export function saveApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, key.trim());
  } catch (error) {
    console.error('Failed to save API key to localStorage:', error);
  }
}

export function clearApiKey(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear API key from localStorage:', error);
  }
}

export function loadOpenAiApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to load OpenAI API key from localStorage:', error);
    return null;
  }
}

export function saveOpenAiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, key.trim());
  } catch (error) {
    console.error('Failed to save OpenAI API key to localStorage:', error);
  }
}

export function clearOpenAiApiKey(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear OpenAI API key from localStorage:', error);
  }
}

export function loadDeepLApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(DEEPL_API_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to load DeepL API key from localStorage:', error);
    return null;
  }
}

export function saveDeepLApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEEPL_API_KEY_STORAGE_KEY, key.trim());
  } catch (error) {
    console.error('Failed to save DeepL API key to localStorage:', error);
  }
}

export function clearDeepLApiKey(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DEEPL_API_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear DeepL API key from localStorage:', error);
  }
}

const OLLAMA_URL_STORAGE_KEY = 'dubbiovi_ollama_url';
const OLLAMA_MODEL_STORAGE_KEY = 'dubbiovi_ollama_model';

export function loadOllamaConfig(): { url: string; model: string } {
  if (typeof window === 'undefined') {
    return { url: 'http://localhost:11434', model: '' };
  }
  try {
    const url = localStorage.getItem(OLLAMA_URL_STORAGE_KEY) || 'http://localhost:11434';
    const model = localStorage.getItem(OLLAMA_MODEL_STORAGE_KEY) || '';
    return { url, model };
  } catch (error) {
    console.error('Failed to load Ollama config from localStorage:', error);
    return { url: 'http://localhost:11434', model: '' };
  }
}

export function saveOllamaConfig(url: string, model: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OLLAMA_URL_STORAGE_KEY, url.trim());
    localStorage.setItem(OLLAMA_MODEL_STORAGE_KEY, model.trim());
  } catch (error) {
    console.error('Failed to save Ollama config to localStorage:', error);
  }
}

export function clearOllamaConfig(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(OLLAMA_URL_STORAGE_KEY);
    localStorage.removeItem(OLLAMA_MODEL_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear Ollama config from localStorage:', error);
  }
}
