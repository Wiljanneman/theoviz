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
  private proxyUrl = environment.proxyUrl || 'http://localhost:3001/api/claude';
  private model = 'claude-3-5-sonnet-20240620';
  private appSecret = environment.appSecret || 'dev-secret-change-in-production';

  private async signRequest(body: any): Promise<{ timestamp: string; signature: string }> {
    const timestamp = Date.now().toString();
    const data = timestamp + JSON.stringify(body);
    
    // Use Web Crypto API to create HMAC signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.appSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(data)
    );
    
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return { timestamp, signature };
  }

  async generateQuestion(verseText: string, verseReference: string): Promise<string> {

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

    const body = { prompt };
    const { timestamp, signature } = await this.signRequest(body);

    const response = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'timestamp': timestamp,
        'signature': signature
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate question');
    }

    const data: ClaudeResponse = await response.json();
    return data.content[0].text;
  }
}
