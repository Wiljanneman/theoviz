import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  id: string;
  model: string;
  role: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ClaudeService {
  private apiKey = ''; // Will be set by user
  private proxyUrl = environment.proxyUrl || 'http://localhost:3001/api/claude';
  private model = 'claude-3-5-sonnet-20240620';

  setApiKey(key: string): void {
    this.apiKey = key;
    localStorage.setItem('claude_api_key', key);
  }

  getApiKey(): string {
    if (!this.apiKey) {
      // Try to get from localStorage first
      const storedKey = localStorage.getItem('claude_api_key');
      if (storedKey) {
        this.apiKey = storedKey;
      } else if (environment.claudeApiKey) {
        // Use environment key as fallback (only available in development)
        this.apiKey = environment.claudeApiKey;
      }
    }
    return this.apiKey;
  }

  hasApiKey(): boolean {
    return !!this.getApiKey();
  }

  async generateQuestion(verseText: string, verseReference: string): Promise<string> {
    if (!this.hasApiKey()) {
      throw new Error('Claude API key not set');
    }

    const prompt = `You are a thoughtful Bible study facilitator. Generate ONE insightful, thought-provoking remark or question.

The question can be about interpretation, application, context, or implications of the passage.:
- be theology laden. You can use Greek or Hebrew terms if relevant
- invite deeper exploration of the Scripture passage
- Encourage personal reflection and application
- Be open-ended (not yes/no)
- Connect to everyday life experiences
- Inspire meaningful group conversation
- Be 1-2 sentences maximum

Scripture Reference: ${verseReference}
Text: ${verseText}

Generate only the question, nothing else.`;

    const response = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        apiKey: this.getApiKey()
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate question');
    }

    const data: ClaudeResponse = await response.json();
    return data.content[0].text;
  }
}
