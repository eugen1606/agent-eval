/**
 * Shared API client instance
 * All components should import from here instead of creating their own instances
 */
import { createClient } from '@agent-eval/api-client';
import { config } from './config';

// Single shared instance configured with the correct API URL
export const apiClient = createClient(config.apiUrl);
