import { DeepResearchTool } from './deep-research-tool';
import { GoogleSearchTool } from './google-search-tool';
import type { Tool } from './types';
import { WebFetchTool } from './web-fetch-tool';

/**
 * Get web-related tools
 */
export function getWebTools(): Tool[] {
  return [new GoogleSearchTool(), new WebFetchTool(), new DeepResearchTool()];
}
