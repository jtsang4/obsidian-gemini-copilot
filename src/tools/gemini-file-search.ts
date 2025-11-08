import { GoogleGenAI } from '@google/genai';
import type ObsidianGemini from '../main';
import { ToolCategory } from '../types/agent';
import type { Tool, ToolExecutionContext, ToolResult } from './types';

export class GeminiFileSearchTool implements Tool {
  name = 'search_vault_files';
  displayName = 'Search Vault Files';
  category = ToolCategory.READ_ONLY;
  description =
    'Semantic search over your Obsidian vault. Returns matches with vault paths (if available) so results can be opened directly.';

  parameters = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string' as const,
        description: 'Semantic search query',
      },
      limit: {
        type: 'number' as const,
        description: 'Maximum number of results to return (default 10, max 50)',
      },
      metadataFilter: {
        type: 'string' as const,
        description: 'Optional metadata filter (AIP-160) to constrain search scope',
      },
    },
    required: ['query'],
  };

  async execute(
    params: { query: string; limit?: number; metadataFilter?: string },
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const plugin = context.plugin as InstanceType<typeof ObsidianGemini>;

    try {
      if (!plugin.settings.apiKey) {
        return { success: false, error: 'Google API key not configured' };
      }
      const fs = plugin.settings.fileSearch;
      if (!fs?.enabled) {
        return { success: false, error: 'File Search is disabled. Enable it in settings.' };
      }
      if (!fs.storeName) {
        return { success: false, error: 'File Search store is not initialized yet.' };
      }

      const genAI = new GoogleGenAI({ apiKey: plugin.settings.apiKey });
      const modelToUse = plugin.settings.chatModelName || 'gemini-2.0-flash-exp';

      const tools = [
        {
          fileSearch: {
            fileSearchStoreNames: [fs.storeName],
            ...(params.metadataFilter ? { metadataFilter: params.metadataFilter } : {}),
          },
        },
      ];

      const result = await genAI.models.generateContent({
        model: modelToUse,
        contents: params.query,
        config: { tools },
      });

      return {
        success: true,
        data: {
          response: result.text || 'No response generated',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Gemini File Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

export function getGeminiFileSearchTool(): Tool {
  return new GeminiFileSearchTool();
}
