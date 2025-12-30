import { Injectable, Logger } from '@nestjs/common';
import { LLMJudgeResponse } from '@agent-eval/shared';

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  async evaluateWithLLM(
    question: string,
    answer: string,
    expectedAnswer?: string
  ): Promise<LLMJudgeResponse> {
    // This is a placeholder for the actual LLM integration
    // You would integrate with OpenAI, Anthropic, or another LLM provider here

    const prompt = this.buildEvaluationPrompt(question, answer, expectedAnswer);

    try {
      // For now, return a mock response
      // Replace this with actual LLM API call
      const llmResponse = await this.callLLM(prompt);
      return this.parseEvaluationResponse(llmResponse);
    } catch (error) {
      this.logger.error('LLM evaluation failed', error);
      return {
        score: 0,
        reasoning: `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isCorrect: false,
      };
    }
  }

  private buildEvaluationPrompt(
    question: string,
    answer: string,
    expectedAnswer?: string
  ): string {
    let prompt = `You are an expert evaluator. Please evaluate the following answer to a question.

Question: ${question}

Provided Answer: ${answer}
`;

    if (expectedAnswer) {
      prompt += `\nExpected Answer: ${expectedAnswer}`;
    }

    prompt += `

Please evaluate the answer and provide:
1. A score from 0 to 100 (where 100 is perfect)
2. Whether the answer is correct (true/false)
3. A brief reasoning for your evaluation

Respond in JSON format:
{
  "score": <number>,
  "isCorrect": <boolean>,
  "reasoning": "<string>"
}`;

    return prompt;
  }

  private async callLLM(prompt: string): Promise<string> {
    // Check for OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (openaiApiKey) {
      return this.callOpenAI(prompt, openaiApiKey);
    }

    // Check for Anthropic API key
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (anthropicApiKey) {
      return this.callAnthropic(prompt, anthropicApiKey);
    }

    // Return mock response if no API keys configured
    this.logger.warn('No LLM API key configured. Using mock evaluation.');
    return JSON.stringify({
      score: 75,
      isCorrect: true,
      reasoning: 'Mock evaluation - configure OPENAI_API_KEY or ANTHROPIC_API_KEY for real evaluations',
    });
  }

  private async callOpenAI(prompt: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async callAnthropic(prompt: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  private parseEvaluationResponse(response: string): LLMJudgeResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: parsed.score ?? 0,
          isCorrect: parsed.isCorrect ?? false,
          reasoning: parsed.reasoning ?? 'No reasoning provided',
        };
      }
    } catch (error) {
      this.logger.warn('Failed to parse LLM response as JSON');
    }

    // Fallback parsing
    return {
      score: 50,
      isCorrect: false,
      reasoning: response,
    };
  }
}
