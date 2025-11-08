import type { ToolExecutionContext } from './types';
import { getVaultTools, ListFilesTool, MoveFileTool, ReadFileTool, WriteFileTool } from './vault-tools';

// Mock ScribeFile and ScribeDataView
jest.mock('../files', () => ({
  ScribeFile: jest.fn().mockImplementation(() => ({
    getUniqueLinks: jest.fn().mockReturnValue(new Set()),
    getLinkText: jest.fn((file: any) => `[[${file.name || file.path}]]`),
  })),
}));

jest.mock('../files/dataview-utils', () => ({
  ScribeDataView: jest.fn().mockImplementation(() => ({
    getBacklinks: jest.fn().mockResolvedValue(new Set()),
  })),
}));

// Use the existing mock by extending it
jest.mock('obsidian', () => ({
  ...jest.requireActual('../../__mocks__/obsidian.js'),
  normalizePath: jest.fn((path: string) => path),
  TFolder: class TFolder {
    path: string;
    name: string;
    children: any[];

    constructor() {
      this.path = '';
      this.name = '';
      this.children = [];
    }
  },
}));

// Import the mocked classes
import { TFile, TFolder } from 'obsidian';

// Mock Obsidian objects
const mockFile = new TFile();
(mockFile as any).path = 'test.md';
(mockFile as any).name = 'test.md';
(mockFile as any).stat = {
  size: 100,
  mtime: Date.now(),
  ctime: Date.now(),
};

const mockFolder = new TFolder();
mockFolder.path = 'folder';
mockFolder.name = 'folder';
mockFolder.children = [mockFile];

const mockVault = {
  getAbstractFileByPath: jest.fn(),
  read: jest.fn(),
  create: jest.fn(),
  modify: jest.fn(),
  delete: jest.fn(),
  createFolder: jest.fn(),
  getMarkdownFiles: jest.fn(),
  getRoot: jest.fn(),
  rename: jest.fn(),
  adapter: {
    exists: jest.fn(),
  },
};

const mockMetadataCache = {
  getFirstLinkpathDest: jest.fn(),
};

const mockPlugin = {
  app: {
    vault: mockVault,
    metadataCache: mockMetadataCache,
  },
  settings: {
    historyFolder: 'test-history-folder',
  },
  gfile: {
    getUniqueLinks: jest.fn().mockReturnValue(new Set()),
    getLinkText: jest.fn((file: any) => `[[${file.name || file.path}]]`),
  },
} as any;

const mockContext: ToolExecutionContext = {
  plugin: mockPlugin,
  session: {
    id: 'test-session',
    type: 'agent-session',
    context: {
      contextFiles: [],
      contextDepth: 2,
      enabledTools: [],
      requireConfirmation: [],
    },
  },
} as any;

describe('VaultTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ReadFileTool', () => {
    let tool: ReadFileTool;

    beforeEach(() => {
      tool = new ReadFileTool();
    });

    it('should read file successfully', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockVault.read.mockResolvedValue('file content');

      const result = await tool.execute({ path: 'test.md' }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        path: 'test.md',
        wikilink: '[[test.md]]',
        content: 'file content',
        size: 100,
        modified: mockFile.stat.mtime,
        outgoingLinks: [],
        backlinks: [],
      });
    });

    it('should return error for non-existent file', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      mockVault.getMarkdownFiles.mockReturnValue([]);
      mockMetadataCache.getFirstLinkpathDest.mockReturnValue(null);

      const result = await tool.execute({ path: 'nonexistent.md' }, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found: nonexistent.md');
    });

    it('should return error for folder path', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(mockFolder);

      const result = await tool.execute({ path: 'folder' }, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path is not a file: folder');
    });
  });

  describe('WriteFileTool', () => {
    let tool: WriteFileTool;

    beforeEach(() => {
      tool = new WriteFileTool();
    });

    it('should modify existing file', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockVault.modify.mockResolvedValue(undefined);

      const result = await tool.execute({ path: 'test.md', content: 'new content' }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        path: 'test.md',
        action: 'modified',
        size: 11,
      });
      expect(mockVault.modify).toHaveBeenCalledWith(mockFile, 'new content');
    });

    it('should create new file', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);
      mockVault.create.mockResolvedValue(mockFile);

      const result = await tool.execute({ path: 'new.md', content: 'new content' }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        path: 'new.md',
        action: 'created',
        size: 11,
      });
      expect(mockVault.create).toHaveBeenCalledWith('new.md', 'new content');
    });

    it('should have confirmation message', () => {
      const message = tool.confirmationMessage?.({ path: 'test.md', content: 'content' });
      expect(message).toContain('Write content to file: test.md');
      expect(message).toContain('content');
    });
  });

  describe('ListFilesTool', () => {
    let tool: ListFilesTool;

    beforeEach(() => {
      tool = new ListFilesTool();
    });

    it('should list files in folder', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(mockFolder);

      const result = await tool.execute({ path: 'folder' }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        path: 'folder',
        files: [
          {
            name: 'test.md',
            path: 'test.md',
            type: 'file',
            size: 100,
            modified: mockFile.stat.mtime,
          },
        ],
        count: 1,
      });
    });

    it('should list root files when path is empty', async () => {
      const rootFolder = new TFolder();
      rootFolder.children = [mockFile];
      mockVault.getRoot.mockReturnValue(rootFolder);

      const result = await tool.execute({ path: '' }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.path).toBe('');
      expect(result.data?.count).toBe(1);
    });

    it('should return error for non-existent folder', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);

      const result = await tool.execute({ path: 'nonexistent' }, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Folder not found: nonexistent');
    });
  });


  describe('MoveFileTool', () => {
    let tool: MoveFileTool;

    beforeEach(() => {
      tool = new MoveFileTool();
    });

    it('should move file successfully', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockVault.adapter.exists.mockResolvedValue(false);
      mockVault.createFolder.mockResolvedValue(undefined);
      mockVault.rename.mockResolvedValue(undefined);

      const result = await tool.execute(
        {
          sourcePath: 'test.md',
          targetPath: 'folder/renamed.md',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        sourcePath: 'test.md',
        targetPath: 'folder/renamed.md',
        action: 'moved',
      });
      expect(mockVault.rename).toHaveBeenCalledWith(mockFile, 'folder/renamed.md');
    });

    it('should return error for non-existent source file', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(null);

      const result = await tool.execute(
        {
          sourcePath: 'nonexistent.md',
          targetPath: 'new.md',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Source file not found: nonexistent.md');
    });

    it('should return error if source is a folder', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(mockFolder);

      const result = await tool.execute(
        {
          sourcePath: 'folder',
          targetPath: 'new-folder',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Source path is not a file: folder');
    });

    it('should return error if target already exists', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockVault.adapter.exists.mockResolvedValue(true);

      const result = await tool.execute(
        {
          sourcePath: 'test.md',
          targetPath: 'existing.md',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Target path already exists: existing.md');
    });

    it('should create target directory if needed', async () => {
      mockVault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockVault.adapter.exists
        .mockResolvedValueOnce(false) // target file doesn't exist
        .mockResolvedValueOnce(false); // target dir doesn't exist
      mockVault.createFolder.mockResolvedValue(undefined);
      mockVault.rename.mockResolvedValue(undefined);

      const result = await tool.execute(
        {
          sourcePath: 'test.md',
          targetPath: 'new-folder/moved.md',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(mockVault.createFolder).toHaveBeenCalledWith('new-folder');
      expect(mockVault.rename).toHaveBeenCalledWith(mockFile, 'new-folder/moved.md');
    });

    it('should have confirmation message', () => {
      const message = tool.confirmationMessage?.({
        sourcePath: 'old.md',
        targetPath: 'new.md',
      });
      expect(message).toContain('Move file from: old.md');
      expect(message).toContain('To: new.md');
    });
  });

  describe('GetActiveFileTool', () => {
    let tool: any;

    beforeEach(() => {
      const { GetActiveFileTool } = require('./vault-tools');
      tool = new GetActiveFileTool();
    });

    it('should get active file and return full content', async () => {
      const mockActiveFile = new TFile();
      (mockActiveFile as any).path = 'active.md';
      (mockActiveFile as any).name = 'active.md';
      (mockActiveFile as any).extension = 'md';
      (mockActiveFile as any).stat = {
        size: 200,
        mtime: Date.now(),
        ctime: Date.now(),
      };

      const mockWorkspace = {
        getActiveFile: jest.fn().mockReturnValue(mockActiveFile),
      };

      const contextWithWorkspace = {
        ...mockContext,
        plugin: {
          ...mockPlugin,
          app: {
            ...mockPlugin.app,
            workspace: mockWorkspace,
          },
        },
      };

      mockVault.getAbstractFileByPath.mockReturnValue(mockActiveFile);
      mockVault.read.mockResolvedValue('active file content');

      const result = await tool.execute({}, contextWithWorkspace);

      expect(result.success).toBe(true);
      expect(result.data.path).toBe('active.md');
      expect(result.data.content).toBe('active file content');
      expect(mockWorkspace.getActiveFile).toHaveBeenCalled();
    });

    it('should return error when no file is active', async () => {
      const mockWorkspace = {
        getActiveFile: jest.fn().mockReturnValue(null),
      };

      const contextWithWorkspace = {
        ...mockContext,
        plugin: {
          ...mockPlugin,
          app: {
            ...mockPlugin.app,
            workspace: mockWorkspace,
          },
        },
      };

      const result = await tool.execute({}, contextWithWorkspace);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No file is currently active in the editor');
    });

    it('should return error when active file is not markdown', async () => {
      const mockActiveFile = new TFile();
      (mockActiveFile as any).path = 'image.png';
      (mockActiveFile as any).extension = 'png';

      const mockWorkspace = {
        getActiveFile: jest.fn().mockReturnValue(mockActiveFile),
      };

      const contextWithWorkspace = {
        ...mockContext,
        plugin: {
          ...mockPlugin,
          app: {
            ...mockPlugin.app,
            workspace: mockWorkspace,
          },
        },
      };

      const result = await tool.execute({}, contextWithWorkspace);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not a markdown file');
    });
  });

  describe('getVaultTools', () => {
    it('should return all vault tools', () => {
      const tools = getVaultTools();
      expect(tools).toHaveLength(7);
      expect(tools.map((t) => t.name)).toContain('read_file');
      expect(tools.map((t) => t.name)).toContain('write_file');
      expect(tools.map((t) => t.name)).toContain('list_files');
      expect(tools.map((t) => t.name)).toContain('create_folder');
      expect(tools.map((t) => t.name)).toContain('delete_file');
      expect(tools.map((t) => t.name)).toContain('move_file');
      expect(tools.map((t) => t.name)).toContain('get_active_file');
    });
  });
});
