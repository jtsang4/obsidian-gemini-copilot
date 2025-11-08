import type { App, WorkspaceLeaf } from 'obsidian';
import type { ModelApi } from '../api/interfaces/model-api';
import { GeminiClientFactory } from '../api/simple-factory';
import type ObsidianGemini from '../main';
import { ToolExecutionEngine } from '../tools/execution-engine';
import { ToolRegistry } from '../tools/tool-registry';
import type { ChatSession, SessionModelConfig } from '../types/agent';
import { AgentView } from '../ui/agent-view';
import { SessionManager } from './session-manager';

/**
 * Configuration for creating an agent
 */
export interface AgentConfig {
  session: ChatSession;
  toolRegistry: ToolRegistry;
  executionEngine: ToolExecutionEngine;
  modelConfig?: SessionModelConfig;
}

/**
 * Factory for creating agent-related components
 * Centralizes the creation and configuration of agent mode
 */
export const AgentFactory = {
  /**
   * Create a complete agent setup
   *
   * @param plugin The plugin instance
   * @param app The Obsidian app instance
   * @returns Agent components
   */
  createAgent(
    plugin: InstanceType<typeof ObsidianGemini>,
    _app: App
  ): {
    sessionManager: SessionManager;
    toolRegistry: ToolRegistry;
    executionEngine: ToolExecutionEngine;
  } {
    // Create session manager
    const sessionManager = new SessionManager(plugin);

    // Create tool registry
    const toolRegistry = new ToolRegistry(plugin);

    // Create execution engine
    const executionEngine = new ToolExecutionEngine(plugin, toolRegistry);

    return {
      sessionManager,
      toolRegistry,
      executionEngine,
    };
  },

  /**
   * Create an agent view
   *
   * @param leaf The workspace leaf
   * @param plugin The plugin instance
   * @param sessionManager The session manager
   * @param executionEngine The tool execution engine
   * @returns Configured AgentView instance
   */
  createAgentView(
    leaf: WorkspaceLeaf,
    plugin: InstanceType<typeof ObsidianGemini>,
    _sessionManager: SessionManager,
    _executionEngine: ToolExecutionEngine
  ): AgentView {
    return new AgentView(leaf, plugin);
  },

  /**
   * Create a model API for agent mode with session configuration
   *
   * @param plugin The plugin instance
   * @param session The current chat session
   * @returns Configured ModelApi instance
   */
  createAgentModel(plugin: InstanceType<typeof ObsidianGemini>, session: ChatSession): ModelApi {
    // Use session's model configuration if available
    return GeminiClientFactory.createChatModel(plugin, session.modelConfig);
  },

  /**
   * Create a model API for a specific agent task
   *
   * @param plugin The plugin instance
   * @param config Agent configuration
   * @param taskType Optional task type for specialized models
   * @returns Configured ModelApi instance
   */
  createAgentTaskModel(
    plugin: InstanceType<typeof ObsidianGemini>,
    config: AgentConfig,
    _taskType?: 'summarize' | 'research' | 'code'
  ): ModelApi {
    // For now, use the session's model config for all tasks
    // In the future, we might want different models for different tasks
    return AgentFactory.createAgentModel(plugin, config.session);
  },

  /**
   * Initialize agent components for the plugin
   *
   * @param plugin The plugin instance
   */
  async initializeAgent(plugin: InstanceType<typeof ObsidianGemini>): Promise<void> {
    // This would be called during plugin load to set up agent infrastructure
    const { sessionManager, toolRegistry, executionEngine } = AgentFactory.createAgent(plugin, plugin.app);

    // Store references in the plugin
    plugin.sessionManager = sessionManager;
    plugin.toolRegistry = toolRegistry;
    plugin.toolExecutionEngine = executionEngine;

    // Session manager doesn't need initialization
  },
} as const;
