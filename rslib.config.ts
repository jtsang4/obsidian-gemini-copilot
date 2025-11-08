import { defineConfig } from '@rslib/core';
import builtinModules from 'builtin-modules';

const isProd = process.env.NODE_ENV === 'production';

const externalPkgs = [
  'obsidian',
  'electron',
  // Optional native deps pulled by ws
  'bufferutil',
  'utf-8-validate',
  '@codemirror/autocomplete',
  '@codemirror/collab',
  '@codemirror/commands',
  '@codemirror/language',
  '@codemirror/lint',
  '@codemirror/search',
  '@codemirror/state',
  '@codemirror/view',
  '@lezer/common',
  '@lezer/highlight',
  '@lezer/lr',
  ...builtinModules,
];

export default defineConfig({
  // Force single bundle output without async chunks
  performance: {
    chunkSplit: {
      strategy: 'all-in-one',
    },
  },
  lib: [
    {
      format: 'cjs',
      bundle: true,
      autoExternal: false,
      autoExtension: false,
      output: {
        target: 'node',
        sourceMap: isProd
          ? false
          : {
              js: 'inline-source-map',
              css: false,
            },
        minify: isProd ? true : false,
        filename: { js: 'main.js' },
        externals: externalPkgs,
      },
      source: {
        entry: { index: './src/main.ts' },
      },
      tools: {
        rspack(config: any) {
          config.optimization = {
            ...(config.optimization || {}),
            splitChunks: false,
            runtimeChunk: false,
          };
          config.module = config.module || {};
          // Global parser setting to avoid async chunks from dynamic import in all JS/TS (incl. node_modules)
          config.module.parser = {
            ...(config.module.parser || {}),
            javascript: {
              ...(config.module.parser?.javascript || {}),
              dynamicImportMode: 'eager',
            },
          };
          config.module.rules = [
            ...(config.module.rules || []),
            {
              test: /\.(txt|hbs)$/,
              type: 'asset/source',
            },
            // Force all dynamic imports to be bundled eagerly into main.js
            {
              test: /\.[cm]?[jt]sx?$/,
              parser: {
                javascript: {
                  dynamicImportMode: 'eager',
                },
              },
            },
          ];
          return config;
        },
      },
    },
  ],
});
