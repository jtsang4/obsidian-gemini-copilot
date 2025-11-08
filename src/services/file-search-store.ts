import { GoogleGenAI, type UploadToFileSearchStoreOperation } from '@google/genai';
import type { TFile } from 'obsidian';
import type ObsidianGemini from '../main';
import { shouldExcludePathForPlugin as shouldExcludePath } from '../utils/file-utils';

export interface FileSearchFileEntry {
  docId?: string;
  sha256?: string;
  mtime: number;
  size: number;
}

export interface FileSearchSettings {
  enabled: boolean;
  storeName?: string; // fileSearchStores/<id>
  storeDisplayName?: string; // obsidian-<vaultName>
  includeDirs: string[];
  excludeDirs: string[];
  excludeGlobs: string[];
  chunking: { maxTokensPerChunk: number; maxOverlapTokens: number };
  maxConcurrentUploads: number;
  debounceMs: number;
  files: Record<string, FileSearchFileEntry>;
  lastFullScan?: number;
}

export class FileSearchStoreService {
  private plugin: InstanceType<typeof ObsidianGemini>;
  private uploading = 0;

  constructor(plugin: InstanceType<typeof ObsidianGemini>) {
    this.plugin = plugin;
  }

  isEnabled(): boolean {
    return !!this.plugin.settings.fileSearch?.enabled;
  }

  getStoreName(): string | undefined {
    return this.plugin.settings.fileSearch?.storeName;
  }

  async ensureInitialized(): Promise<void> {
    const s = this.plugin.settings.fileSearch;
    if (!s?.enabled) {
      return;
    }
    if (s.storeName) {
      return;
    }

    if (!this.plugin.settings.apiKey) {
      throw new Error('API key is not configured');
    }

    const ai = new GoogleGenAI({ apiKey: this.plugin.settings.apiKey });
    const displayName = `obsidian-${this.plugin.app.vault.getName()}`;
    const store = await ai.fileSearchStores.create({ config: { displayName } });
    this.plugin.settings.fileSearch = {
      ...s,
      storeName: store.name,
      storeDisplayName: displayName,
    } as FileSearchSettings;
    console.info('[FileSearch] store created', store.name);
    await this.plugin.saveData(this.plugin.settings);
  }

  onLayoutReady(): void {
    if (!this.isEnabled()) {
      return;
    }

    const vault = this.plugin.app.vault;
    this.plugin.registerEvent(vault.on('create', (f) => this.onFileCreated(f as TFile)));
    this.plugin.registerEvent(vault.on('modify', (f) => this.onFileModified(f as TFile)));
    this.plugin.registerEvent(vault.on('delete', (f) => this.onFileDeleted(f as TFile)));
    this.plugin.registerEvent(
      vault.on('rename', (f, oldPath) => this.onFileRenamed(f as TFile, oldPath))
    );

    // Kick off ensure + initial scan (fire and forget)
    this.ensureInitialized()
      .then(() => this.initialScanAndSync())
      .catch((e) => console.error('[FileSearch] init/scan failed:', e));
  }

  private pathIncluded(path: string): boolean {
    const fs = this.plugin.settings.fileSearch as FileSearchSettings | undefined;
    if (!fs) return false;

    // System folder protection
    if (shouldExcludePath(path, this.plugin)) return false;

    // Exclude by blacklist
    if (fs.excludeDirs?.some((d) => path === d || path.startsWith(`${d}/`))) return false;

    // Include by whitelist (or all if empty)
    return (
      fs.includeDirs.length === 0 || fs.includeDirs.some((d) => path === d || path.startsWith(`${d}/`))
    );
  }

  async initialScanAndSync(): Promise<void> {
    const fs = this.plugin.settings.fileSearch as FileSearchSettings | undefined;
    if (!fs?.enabled || !fs.storeName) return;

    const files = this.plugin.app.vault.getMarkdownFiles();
    for (const f of files) {
      const included = this.pathIncluded(f.path);
      if (!included) continue;
      await this.syncOne(f, false);
    }
    fs.lastFullScan = Date.now();
    await this.plugin.saveData(this.plugin.settings);
  }

  private async onFileCreated(file: TFile) {
    if (this.pathIncluded(file.path)) await this.syncOne(file, true);
  }

  private async onFileModified(file: TFile) {
    if (this.pathIncluded(file.path)) await this.syncOne(file, false);
  }

  private async onFileDeleted(file: TFile) {
    await this.removeOne(file.path);
  }

  private async onFileRenamed(file: TFile, oldPath: string) {
    await this.removeOne(oldPath);
    if (this.pathIncluded(file.path)) await this.syncOne(file, true);
  }

  private async computeSha256(buffer: ArrayBuffer): Promise<string> {
    try {
      const hash = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      return '';
    }
  }

  async syncOne(file: TFile, force: boolean): Promise<void> {
    const settings = this.plugin.settings.fileSearch as FileSearchSettings | undefined;
    if (!settings?.enabled || !settings.storeName) {
      return;
    }

    const arr = await this.plugin.app.vault.readBinary(file);
    const buf: ArrayBuffer = arr as ArrayBuffer;
    const sha = await this.computeSha256(buf);
    const stat = file.stat;

    const prev = settings.files[file.path];
    const missingDocId = !prev?.docId;
    if (!force && prev && prev.sha256 === sha && prev.mtime === stat.mtime && !missingDocId) {
      return;
    }
    if (missingDocId && prev) {
    }

    // Concurrency cap
    while (this.uploading >= (settings.maxConcurrentUploads || 3)) {
      await new Promise((r) => setTimeout(r, 100));
    }

    this.uploading++;
    let docId: string | undefined;
    try {
      const ai = new GoogleGenAI({ apiKey: this.plugin.settings.apiKey });
      const blob = new Blob([buf], { type: 'text/markdown' });

      let success = false;
      try {
        const operation = await ai.fileSearchStores.uploadToFileSearchStore({
          fileSearchStoreName: settings.storeName,
          file: blob,
          config: {
            mimeType: 'text/markdown',
            chunkingConfig: {
              whiteSpaceConfig: {
                maxTokensPerChunk: settings.chunking.maxTokensPerChunk,
                maxOverlapTokens: settings.chunking.maxOverlapTokens,
              },
            },
            customMetadata: [
              { key: 'vault_path', stringValue: file.path },
              { key: 'mtime', numericValue: stat.mtime },
              { key: 'size', numericValue: stat.size },
            ],
          },
        });
        docId = await this.resolveUploadDocumentId(ai, operation, file.path);
        success = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Some SDK builds throw SyntaxError on empty JSON (204). Treat as success.
        if (/Unexpected end of input/i.test(msg)) {
          success = true;
        } else {
          throw err;
        }
      }

      if (success) {
        settings.files[file.path] = {
          docId,
          sha256: sha,
          mtime: stat.mtime,
          size: stat.size,
        };
        await this.plugin.saveData(this.plugin.settings);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[FileSearch] upload failed:', msg, e);
    } finally {
      this.uploading--;
    }
  }

  async removeOne(vaultPath: string): Promise<void> {
    const settings = this.plugin.settings.fileSearch as FileSearchSettings | undefined;
    if (!settings) return;
    const entry = settings.files[vaultPath];
    if (!entry) {
      return;
    }

    try {
      // SDK document deletion path may vary; best-effort local cleanup
      // Optionally: ai.fileSearchStores.documents.delete({ name: entry.docId })
    } finally {
      delete settings.files[vaultPath];
      await this.plugin.saveData(this.plugin.settings);
    }
  }

  logDebugSummary(): void {
    const fs = this.plugin.settings.fileSearch as FileSearchSettings | undefined;
    const filesCount = fs?.files ? Object.keys(fs.files).length : 0;
    const missingDocIds = fs?.files ? Object.values(fs.files).filter((entry) => !entry.docId).length : 0;
    const sample = fs?.files ? Object.keys(fs.files).slice(0, 5) : [];
    console.info('[FileSearch] summary', {
      enabled: !!fs?.enabled,
      storeName: fs?.storeName,
      includeDirs: fs?.includeDirs,
      excludeDirs: fs?.excludeDirs,
      filesCount,
      missingDocIds,
      samplePaths: sample,
      uploading: this.uploading,
      lastFullScan: fs?.lastFullScan,
    });
  }

  private async resolveUploadDocumentId(
    ai: GoogleGenAI,
    operation: UploadToFileSearchStoreOperation | undefined,
    vaultPath?: string
  ): Promise<string | undefined> {
    if (!operation) return this.findDocumentNameByPath(ai, vaultPath);
    const docName = this.extractDocumentName(operation);
    if (docName) return docName;
    if (!operation.name) {
      return this.findDocumentNameByPath(ai, vaultPath);
    }

    const maxAttempts = 10;
    const intervalMs = 1000;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const polled = (await ai.operations.get({ operation })) as UploadToFileSearchStoreOperation;
        if (polled?.done) {
          const resolved = this.extractDocumentName(polled);
          if (resolved) {
            return resolved;
          }
          if (polled.error) {
            console.error('[FileSearch] resolveUploadDocumentId: operation error', polled.error);
            return undefined;
          }
        }
      } catch (err) {
        console.error('[FileSearch] resolveUploadDocumentId: polling failed', err);
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return this.findDocumentNameByPath(ai, vaultPath);
  }

  private extractDocumentName(operation: UploadToFileSearchStoreOperation | undefined): string | undefined {
    return operation?.response?.documentName;
  }

  private async findDocumentNameByPath(ai: GoogleGenAI, vaultPath?: string): Promise<string | undefined> {
    if (!vaultPath) return undefined;
    const storeName = this.plugin.settings.fileSearch?.storeName;
    if (!storeName) return undefined;

    try {
      const pager = await ai.fileSearchStores.documents.list({ parent: storeName, config: { pageSize: 200 } });
      for await (const doc of (pager as AsyncIterable<any>)) {
        const metadata = (doc as { customMetadata?: Array<{ key?: string; stringValue?: string }> }).customMetadata || [];
        const pathMeta = metadata.find((kv) => kv.key === 'vault_path')?.stringValue;
        if (pathMeta === vaultPath && doc?.name) {
          return doc.name;
        }
      }
    } catch (err) {
      console.error('[FileSearch] findDocumentNameByPath failed', err);
    }

    return undefined;
  }
}
