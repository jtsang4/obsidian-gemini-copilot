/**
 * API module for Gemini AI integration
 */

export type { GeminiClientConfig } from './gemini-client';
// Export the client
export { GeminiClient } from './gemini-client';
// Re-export the interfaces
export type {
  BaseModelRequest,
  ExtendedModelRequest,
  ModelApi,
  ModelResponse,
  ToolCall,
  ToolDefinition,
} from './interfaces/model-api';
// Export the simplified factory
export { GeminiClientFactory, ModelUseCase } from './simple-factory';
