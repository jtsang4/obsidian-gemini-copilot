/**
 * Obsidian Gemini Scribe - Public API Exports
 *
 * This file exports all public types, interfaces, and classes
 * that can be used by external plugins or extensions.
 */

// Re-export commonly used Obsidian types for convenience
export type {
  App,
  Editor,
  EditorPosition,
  EditorRange,
  MarkdownView,
  MetadataCache,
  Plugin,
  PluginManifest,
  TAbstractFile,
  TFile,
  TFolder,
  Vault,
  Workspace,
} from 'obsidian';
export type { AgentConfig } from './agent/agent-factory';
export { AgentFactory } from './agent/agent-factory';
export { SessionHistory } from './agent/session-history';
export { SessionManager } from './agent/session-manager';
// API Configuration Types
export type {
  ApiConfig,
  ApiFeatures,
  ModelConfig,
  RetryConfig,
} from './api/config/model-config';
export type { GeminiClientConfig } from './api/gemini-client';
// Gemini API Client (for advanced usage)
export { GeminiClient } from './api/gemini-client';
// Model API Interfaces
export type {
  BaseModelRequest,
  ExtendedModelRequest,
  ModelApi,
  ModelResponse,
  StreamCallback,
  StreamingModelResponse,
  ToolDefinition,
} from './api/interfaces/model-api';
// Model and Agent Factories
export {
  GeminiClientFactory,
  ModelUseCase,
} from './api/simple-factory';
// Settings Types
export type {
  ModelDiscoverySettings,
  ObsidianGeminiSettings,
} from './main';
// Main Plugin Class (for type reference)
export { default as ObsidianGeminiPlugin } from './main';
export type {
  GeminiModel,
  ModelRole,
  ModelUpdateResult,
} from './models';
// Model Configuration
export { GEMINI_MODELS } from './models';
export { PromptManager } from './prompts/prompt-manager';
// Prompt System Types
export type {
  CustomPrompt,
  PromptInfo,
} from './prompts/types';
// Service Types
export type {
  GoogleModel,
  ModelDiscoveryResult,
} from './services/model-discovery';
export { ModelDiscoveryService } from './services/model-discovery';
export type { ModelUpdateOptions } from './services/model-manager';
export { ModelManager } from './services/model-manager';
export type {
  ModelParameterInfo,
  ParameterRanges,
} from './services/parameter-validation';
export { ToolExecutionEngine } from './tools/execution-engine';
// Web Tools
export { GoogleSearchTool } from './tools/google-search-tool';
// Tool Loop Detection
export type { LoopDetectionInfo } from './tools/loop-detector';
// Core Classes for Extension
export { ToolRegistry } from './tools/tool-registry';
// Tool System Types
export type {
  Tool,
  ToolCall,
  ToolChoice,
  ToolExecutionContext,
  ToolParameterSchema,
  ToolResult,
} from './tools/types';
// Vault Tools - Useful for creating custom tools
export {
  CreateFolderTool,
  DeleteFileTool,
  getVaultTools,
  ListFilesTool,
  MoveFileTool,
  ReadFileTool,
  SearchFilesTool,
  WriteFileTool,
} from './tools/vault-tools';
export { WebFetchTool } from './tools/web-fetch-tool';
export type {
  // Interfaces
  AgentContext,
  ChatMessage,
  ChatSession,
  SessionModelConfig,
  ToolExecution,
} from './types/agent';
// Agent and Session Types
export {
  // Constants
  DEFAULT_CONTEXTS,
  DestructiveAction,
  SessionType,
  // Enums
  ToolCategory,
} from './types/agent';
// Conversation Types
export type {
  BasicGeminiConversationEntry,
  GeminiConversationEntry,
} from './types/conversation';
