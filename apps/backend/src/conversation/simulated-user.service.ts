import { Injectable, Logger } from '@nestjs/common';
import { ConversationTurn } from '../database/entities';
import { ProxyFetchService } from '../common/proxy-fetch';

export interface SimulatedUserConfig {
  model: string;
  provider?: 'openai' | 'anthropic';
  modelConfig?: { temperature?: number; maxTokens?: number };
  reasoningModel?: boolean;
  reasoningEffort?: string;
  personaSystemPrompt: string;
  goal: string;
}

export type SimulatedUserAction =
  | { type: 'send_message'; text: string }
  | { type: 'end_conversation'; reason: string; goalAchieved: boolean }
  | { type: 'error'; error: string };

const SIMULATED_USER_INSTRUCTIONS = `You are a simulated user interacting with an AI agent. You must follow your persona and work toward achieving your goal.

RULES:
1. Stay in character according to your persona description
2. Work toward achieving the stated goal
3. Respond naturally as a real user would
4. When you believe the goal has been fully achieved (the agent has provided what you need), end the conversation
5. When you believe the goal cannot be achieved, end the conversation
6. Do NOT reveal that you are a simulated user or that you have a specific goal

You MUST respond by calling one of the available tools/functions:
- send_message: Send a message to the agent
- end_conversation: End the conversation with a reason and whether the goal was achieved`;

const TOOLS_OPENAI = [
  {
    type: 'function' as const,
    function: {
      name: 'send_message',
      description: 'Send a message to the AI agent',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The message to send to the agent',
          },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'end_conversation',
      description: 'End the conversation',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Why the conversation is ending',
          },
          goalAchieved: {
            type: 'boolean',
            description: 'Whether the goal was achieved',
          },
        },
        required: ['reason', 'goalAchieved'],
      },
    },
  },
];

const TOOLS_ANTHROPIC = [
  {
    name: 'send_message',
    description: 'Send a message to the AI agent',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: {
          type: 'string',
          description: 'The message to send to the agent',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'end_conversation',
    description: 'End the conversation',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: {
          type: 'string',
          description: 'Why the conversation is ending',
        },
        goalAchieved: {
          type: 'boolean',
          description: 'Whether the goal was achieved',
        },
      },
      required: ['reason', 'goalAchieved'],
    },
  },
];

@Injectable()
export class SimulatedUserService {
  private readonly logger = new Logger(SimulatedUserService.name);

  constructor(private readonly proxyFetchService: ProxyFetchService) {}

  async getNextAction(
    config: SimulatedUserConfig,
    conversationHistory: ConversationTurn[],
    apiKey: string,
  ): Promise<SimulatedUserAction> {
    const provider = config.provider || this.detectProvider(config.model);

    try {
      if (provider === 'anthropic') {
        return await this.callAnthropic(config, conversationHistory, apiKey);
      } else {
        return await this.callOpenAI(config, conversationHistory, apiKey);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Simulated user LLM call failed: ${errorMessage}`, error);
      return { type: 'error', error: errorMessage };
    }
  }

  private detectProvider(model: string): 'openai' | 'anthropic' {
    if (model.startsWith('claude')) {
      return 'anthropic';
    }
    return 'openai';
  }

  private buildUserPrompt(config: SimulatedUserConfig, isFirstTurn: boolean): string {
    if (isFirstTurn) {
      return `Your goal: ${config.goal}\n\nStart the conversation by sending your first message to the agent. Remember to stay in character.`;
    }
    return 'Continue the conversation. Decide whether to send another message or end the conversation based on the agent\'s last response and your goal progress.';
  }

  private buildConversationMessages(
    config: SimulatedUserConfig,
    conversationHistory: ConversationTurn[],
  ): { role: string; content: string }[] {
    const messages: { role: string; content: string }[] = [];

    // First user message with goal context
    messages.push({
      role: 'user',
      content: this.buildUserPrompt(config, conversationHistory.length === 0),
    });

    if (conversationHistory.length === 0) {
      return messages;
    }

    // For subsequent turns, include history and prompt to continue
    // We simulate the tool call + result pattern for past turns
    for (const turn of conversationHistory) {
      if (turn.role === 'user') {
        // The simulated user previously sent this message
        messages.push({
          role: 'assistant',
          content: `I'll send this message: "${turn.message}"`,
        });
      } else {
        // Agent responded
        messages.push({
          role: 'user',
          content: `The agent responded: "${turn.message}"\n\nContinue the conversation. Decide whether to send another message or end the conversation.`,
        });
      }
    }

    return messages;
  }

  private async callOpenAI(
    config: SimulatedUserConfig,
    conversationHistory: ConversationTurn[],
    apiKey: string,
  ): Promise<SimulatedUserAction> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const systemPrompt = `${config.personaSystemPrompt}\n\n${SIMULATED_USER_INSTRUCTIONS}`;
      const messages = this.buildConversationMessages(config, conversationHistory);

      const requestBody: Record<string, unknown> = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        tools: TOOLS_OPENAI,
        tool_choice: 'required',
      };

      if (config.reasoningModel) {
        requestBody['temperature'] = 1;
        if (config.reasoningEffort) {
          requestBody['reasoning_effort'] = config.reasoningEffort;
        }
      } else {
        requestBody['temperature'] = config.modelConfig?.temperature ?? 0.7;
      }

      if (config.modelConfig?.maxTokens) {
        requestBody['max_tokens'] = config.modelConfig.maxTokens;
      }

      const response = await this.proxyFetchService.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`OpenAI API error: ${response.status} ${errorBody}`);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

      if (!toolCall) {
        // Fallback: try to extract from content
        const content = data.choices?.[0]?.message?.content || '';
        if (content) {
          return { type: 'send_message', text: content };
        }
        return { type: 'error', error: 'No tool call in response' };
      }

      const args = JSON.parse(toolCall.function.arguments);

      if (toolCall.function.name === 'send_message') {
        return { type: 'send_message', text: args.text };
      } else if (toolCall.function.name === 'end_conversation') {
        return {
          type: 'end_conversation',
          reason: args.reason,
          goalAchieved: args.goalAchieved,
        };
      }

      return { type: 'error', error: `Unknown tool call: ${toolCall.function.name}` };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callAnthropic(
    config: SimulatedUserConfig,
    conversationHistory: ConversationTurn[],
    apiKey: string,
  ): Promise<SimulatedUserAction> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const systemPrompt = `${config.personaSystemPrompt}\n\n${SIMULATED_USER_INSTRUCTIONS}`;
      const messages = this.buildConversationMessages(config, conversationHistory);

      // Anthropic requires alternating user/assistant messages
      const anthropicMessages = this.normalizeForAnthropic(messages);

      const requestBody: Record<string, unknown> = {
        model: config.model,
        max_tokens: config.modelConfig?.maxTokens || 1024,
        system: systemPrompt,
        messages: anthropicMessages,
        tools: TOOLS_ANTHROPIC,
        tool_choice: { type: 'any' },
      };

      if (config.modelConfig?.temperature !== undefined) {
        requestBody['temperature'] = config.modelConfig.temperature;
      }

      const response = await this.proxyFetchService.fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Anthropic API error: ${response.status} ${errorBody}`);
      }

      const data = await response.json();
      const toolUseBlock = data.content?.find(
        (block: { type: string }) => block.type === 'tool_use',
      );

      if (!toolUseBlock) {
        // Fallback: try text content
        const textBlock = data.content?.find(
          (block: { type: string }) => block.type === 'text',
        );
        if (textBlock?.text) {
          return { type: 'send_message', text: textBlock.text };
        }
        return { type: 'error', error: 'No tool use in response' };
      }

      if (toolUseBlock.name === 'send_message') {
        return { type: 'send_message', text: toolUseBlock.input.text };
      } else if (toolUseBlock.name === 'end_conversation') {
        return {
          type: 'end_conversation',
          reason: toolUseBlock.input.reason,
          goalAchieved: toolUseBlock.input.goalAchieved,
        };
      }

      return { type: 'error', error: `Unknown tool: ${toolUseBlock.name}` };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Ensure messages alternate between user and assistant roles for Anthropic.
   * Merges consecutive same-role messages.
   */
  private normalizeForAnthropic(
    messages: { role: string; content: string }[],
  ): { role: string; content: string }[] {
    if (messages.length === 0) return [];

    const normalized: { role: string; content: string }[] = [];

    for (const msg of messages) {
      const last = normalized[normalized.length - 1];
      if (last && last.role === msg.role) {
        last.content += '\n\n' + msg.content;
      } else {
        normalized.push({ ...msg });
      }
    }

    // Anthropic requires first message to be 'user'
    if (normalized.length > 0 && normalized[0].role !== 'user') {
      normalized.unshift({ role: 'user', content: 'Begin.' });
    }

    return normalized;
  }
}
