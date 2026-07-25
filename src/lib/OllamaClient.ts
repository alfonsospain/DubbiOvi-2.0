export interface OllamaCompletionOptions {
  model?: string;
  system?: string;
  temperature?: number;
  keepAlive?: string; // e.g. "5m" to free RAM/VRAM after 5 minutes of inactivity
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface OllamaCompletionResponse {
  text: string;
  model: string;
  totalDurationMs?: number;
  evalCount?: number;
}

export interface OllamaModelInfo {
  name: string;
  modifiedAt?: string;
  size?: number;
  digest?: string;
  details?: Record<string, any>;
}

export class OllamaClient {
  public baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /**
   * Task-agnostic completion generator calling POST /api/generate
   */
  public async generateCompletion(
    prompt: string,
    options: OllamaCompletionOptions = {}
  ): Promise<OllamaCompletionResponse> {
    const model = (options.model && options.model.trim()) ? options.model.trim() : 'llama3:8b';
    const keepAlive = options.keepAlive ?? '5m';
    const timeoutMs = options.timeoutMs ?? 120000; // 120s default timeout for 8 GB RAM model loading

    const endpoint = `${this.baseUrl}/api/generate`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    const payload: Record<string, any> = {
      model,
      prompt,
      stream: false,
      keep_alive: keepAlive,
    };

    if (options.system) {
      payload.system = options.system;
    }

    if (options.temperature !== undefined) {
      payload.options = { temperature: options.temperature };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorBody = '';
        try {
          errorBody = await response.text();
          console.error(`[OllamaClient] API HTTP ${response.status} Error Response:`, errorBody);
        } catch (_) {}

        if (response.status === 404) {
          throw new Error(
            `Ollama model '${model}' was not found at ${this.baseUrl}. Please run 'ollama pull ${model}' in your terminal to install it.`
          );
        }
        let errorMsg = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errData = JSON.parse(errorBody);
          if (errData.error) errorMsg = errData.error;
        } catch (_) {}
        throw new Error(`Ollama API error: ${errorMsg}`);
      }

      const data = await response.json();

      return {
        text: data.response || '',
        model: data.model || model,
        totalDurationMs: data.total_duration ? Math.round(data.total_duration / 1e6) : undefined,
        evalCount: data.eval_count,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error(`[OllamaClient] Exception caught during generateCompletion:`, error);
      if (error.name === 'AbortError') {
        throw new Error(
          `Ollama request for model '${model}' timed out after ${timeoutMs / 1000}s while loading or generating response. (8 GB RAM cold loading may require additional time).`
        );
      }
      if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
        throw new Error(
          `Unable to connect to Ollama daemon at ${this.baseUrl}. Please verify that Ollama is running.`
        );
      }
      throw error;
    }
  }

  /**
   * Health check verifying daemon availability
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  /**
   * List all locally installed Ollama models
   */
  public async listModels(): Promise<OllamaModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!Array.isArray(data.models)) {
        return [];
      }

      return data.models.map((m: any) => ({
        name: m.name,
        modifiedAt: m.modified_at,
        size: m.size,
        digest: m.digest,
        details: m.details,
      }));
    } catch (error: any) {
      throw new Error(`Failed to retrieve models from Ollama at ${this.baseUrl}: ${error.message}`);
    }
  }
}
