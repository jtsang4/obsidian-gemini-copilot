import type { ToolDefinition } from '../api/interfaces/model-api';
import type { Tool } from './types';

/**
 * Convert a Tool to a ToolDefinition for the API
 */
export function toToolDefinition(tool: Tool): ToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: tool.parameters.type,
      properties: tool.parameters.properties as Record<string, any>,
      required: tool.parameters.required,
    },
  };
}

/**
 * Convert multiple Tools to ToolDefinitions
 */
export function toToolDefinitions(tools: Tool[]): ToolDefinition[] {
  return tools.map((tool) => toToolDefinition(tool));
}

/**
 * Format tools for Gemini API's expected format
 * Gemini expects tools in a specific structure
 */
export function toGeminiFormat(tools: Tool[]): any[] {
  if (!tools || tools.length === 0) {
    return [];
  }

  // Gemini expects tools wrapped in a function_declarations array
  return [
    {
      function_declarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.properties || {},
          required: tool.parameters.required || [],
        },
      })),
    },
  ];
}
