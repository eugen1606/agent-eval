import { Injectable, Logger } from '@nestjs/common';
import { ConversationTurn } from '../database/entities';
import { ProxyFetchService } from '../common/proxy-fetch';

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(private readonly proxyFetchService: ProxyFetchService) {}

  async generateSummary(
    turns: ConversationTurn[],
    goal: string,
    model: string,
    apiKey: string,
  ): Promise<string> {
    const provider = model.startsWith('claude') ? 'anthropic' : 'openai';

    const transcript = turns
      .map((t) => `Turn ${t.index + 1} (${t.role === 'user' ? 'Simulated User' : 'Agent'}): ${t.message}`)
      .join('\n\n');

    const prompt = `Analyze this conversation between a simulated user and an AI agent.

Goal: ${goal}

Conversation:
${transcript}

Provide a structured summary:
1. Brief overview (1-2 sentences)
2. Turn-by-turn analysis (key points only)
3. Outcome: Was the goal achieved? How many turns did it take?
4. Key observations (agent strengths, weaknesses, issues)

Keep the summary concise and actionable.`;

    try {
      if (provider === 'anthropic') {
        return await this.callAnthropic(prompt, model, apiKey);
      } else {
        return await this.callOpenAI(prompt, model, apiKey);
      }
    } catch (error) {
      this.logger.error('Summary generation failed', error);
      return `Summary generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async callOpenAI(prompt: string, model: string, apiKey: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await this.proxyFetchService.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are an expert conversation analyst. Provide concise, structured summaries.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`OpenAI API error: ${response.status} ${errorBody}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callAnthropic(prompt: string, model: string, apiKey: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await this.proxyFetchService.fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          system: 'You are an expert conversation analyst. Provide concise, structured summaries.',
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Anthropic API error: ${response.status} ${errorBody}`);
      }

      const data = await response.json();
      return data.content[0].text;
    } finally {
      clearTimeout(timeout);
    }
  }
}
