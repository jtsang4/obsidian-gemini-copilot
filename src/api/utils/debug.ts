/**
 * Utility for logging debug info for Gemini APIs.
 * @param debugMode Whether debug mode is enabled
 * @param title Title for the debug output
 * @param data Data to log (will be stringified)
 */

// File context node interface
interface FileContextNode {
  path: string;
  content: string;
  wikilink: string;
  links: Record<string, FileContextNode> | Map<string, FileContextNode>;
  [key: string]: unknown;
}

// Processed file context node interface (for debug output)
interface ProcessedFileContextNode {
  path: string;
  content: string;
  wikilink: string;
  links: Record<string, ProcessedFileContextNode>;
  [key: string]: unknown;
}

// Recursively strip linked file contents from a file-context object for debug output
export function stripFileContextNode(node: unknown, isRoot = true): unknown {
  if (!node || typeof node !== 'object') return node;
  // If it looks like a FileContextNode
  if (
    node &&
    typeof node === 'object' &&
    'path' in node &&
    'content' in node &&
    'wikilink' in node &&
    'links' in node
  ) {
    const fileNode = node as FileContextNode;
    const newNode: ProcessedFileContextNode = {
      ...fileNode,
      content: isRoot ? fileNode.content : `[Linked file: ${fileNode.wikilink || fileNode.path}]`,
      // Recursively process links (which may be a Map or object)
      links: {},
    };
    // Support both Map and plain object for links
    const linksObj = fileNode.links instanceof Map ? Object.fromEntries(fileNode.links) : fileNode.links;
    for (const key in linksObj) {
      if (Object.hasOwn(linksObj, key)) {
        const processedLink = stripFileContextNode((linksObj as Record<string, FileContextNode>)[key], false);
        if (processedLink && typeof processedLink === 'object') {
          newNode.links[key] = processedLink as ProcessedFileContextNode;
        }
      }
    }
    return newNode;
  }
  // Fallback: recursively process arrays and objects
  if (Array.isArray(node)) {
    return node.map((item) => stripFileContextNode(item, isRoot));
  } else if (node && typeof node === 'object') {
    const newObj: Record<string, unknown> = {};
    for (const key in node) {
      if (Object.hasOwn(node, key)) {
        newObj[key] = stripFileContextNode((node as Record<string, unknown>)[key], isRoot);
      }
    }
    return newObj;
  }
}

export function stripLinkedFileContents(obj: unknown): unknown {
  // If this is a file-context object or contains one, use the new logic
  if (obj && typeof obj === 'object' && 'path' in obj && 'content' in obj && 'wikilink' in obj && 'links' in obj) {
    return stripFileContextNode(obj, true);
  }
  // Otherwise, fallback to old logic
  if (Array.isArray(obj)) {
    return obj.map(stripLinkedFileContents);
  } else if (obj && typeof obj === 'object') {
    const newObj: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        newObj[key] = stripLinkedFileContents((obj as Record<string, unknown>)[key]);
      }
    }
    return newObj;
  }
  return obj;
}

export function redactLinkedFileSections(prompt: string): string {
  // Split by file section header
  const sectionRegex = /(=+\nFile Label: [^\n]+\nFile Name: [^\n]+\nWikiLink: [^\n]+\n=+\n\n)/g;
  const parts = prompt.split(sectionRegex);
  if (parts.length <= 2) return prompt; // Only current file

  let result = '';
  let sectionCount = 0;
  for (let i = 0; i < parts.length; i++) {
    // Even indices: text between sections (usually empty or trailing newlines)
    // Odd indices: section header
    if (i % 2 === 0) {
      result += parts[i];
    } else {
      // Section header
      result += parts[i];
      sectionCount++;
      if (sectionCount === 1) {
        // Current file: keep following content
        // Find the next section or end
        const _nextSectionIdx = parts[i + 2] !== undefined ? i + 2 : parts.length;
        result += parts[i + 1] || '';
        i++; // Skip content for current file
      } else {
        // Linked file: redact content
        // Try to extract WikiLink from the header
        const wikilinkMatch = parts[i].match(/WikiLink: \[\[(.*?)\]\]/);
        const wikilink = wikilinkMatch ? wikilinkMatch[1] : 'Unknown';
        result += `[Linked file: [[${wikilink}]]]\n\n`;
        i++; // Skip actual content
      }
    }
  }
  return result;
}

// Helper to detect BaseModelRequest
export function isBaseModelRequest(obj: unknown): boolean {
  return !!(
    obj &&
    typeof obj === 'object' &&
    'prompt' in obj &&
    typeof (obj as { prompt: unknown }).prompt === 'string'
  );
}

// Helper to detect ExtendedModelRequest
export function isExtendedModelRequest(obj: unknown): boolean {
  return !!(
    obj &&
    typeof obj === 'object' &&
    'prompt' in obj &&
    typeof (obj as { prompt: unknown }).prompt === 'string' &&
    'conversationHistory' in obj &&
    Array.isArray((obj as { conversationHistory: unknown }).conversationHistory) &&
    'userMessage' in obj &&
    typeof (obj as { userMessage: unknown }).userMessage === 'string'
  );
}

export function formatBaseModelRequest(req: Record<string, unknown>): string {
  return [`Model: ${req.model ?? '[default]'}\n`, `Prompt: ${JSON.stringify(req.prompt, null, 2)}\n`].join('');
}

export function formatExtendedModelRequest(req: Record<string, unknown>): string {
  return [
    `Model: ${req.model ?? '[default]'}\n`,
    `Prompt: ${JSON.stringify(req.prompt, null, 2)}\n`,
    `User Message: ${JSON.stringify(req.userMessage, null, 2)}\n`,
    `Conversation History:`,
    JSON.stringify(req.conversationHistory, null, 2),
    req.renderContent !== undefined ? `\nRender Content: ${req.renderContent}` : '',
  ].join('\n');
}

export function logDebugInfo(debugMode: boolean, title: string, data: unknown) {
  if (!debugMode) return;
  if (isExtendedModelRequest(data)) {
    console.log(
      `[GeminiAPI Debug] ${title} (ExtendedModelRequest):\n${formatExtendedModelRequest(data as Record<string, unknown>)}`
    );
    return;
  }
  if (isBaseModelRequest(data)) {
    console.log(
      `[GeminiAPI Debug] ${title} (BaseModelRequest):\n${formatBaseModelRequest(data as Record<string, unknown>)}`
    );
    return;
  }
  let sanitizedData: unknown;
  if (typeof data === 'string' && data.includes('File Label:')) {
    sanitizedData = redactLinkedFileSections(data);
    console.log(`[GeminiAPI Debug] ${title}:\n${sanitizedData}`);
  } else {
    sanitizedData = stripLinkedFileContents(data);
    console.log(`[GeminiAPI Debug] ${title}:`, JSON.stringify(sanitizedData, null, 2));
  }
}
