// Mock for @google/genai

const GoogleGenAI = jest.fn().mockImplementation(() => ({
  models: {
    generateContent: jest.fn().mockResolvedValue({
      candidates: [
        {
          content: { parts: [{ text: 'Mock response text' }] },
          groundingMetadata: {
            groundingChunks: [
              {
                retrievedContext: {
                  documentName: 'fileSearchStores/mock/documents/mock-doc',
                  title: 'Mock Doc',
                  text: 'Mock snippet',
                },
              },
            ],
            groundingSupports: [
              {
                groundingChunkIndices: [0],
                segment: { text: 'Mock snippet' },
                confidence: 0.9,
                confidenceScores: [0.9],
              },
            ],
          },
        },
      ],
    }),
  },
  fileSearchStores: {
    create: jest.fn().mockResolvedValue({ name: 'fileSearchStores/mock' }),
    uploadToFileSearchStore: jest.fn().mockResolvedValue({
      name: 'operations/mock',
      done: true,
      response: { documentName: 'fileSearchStores/mock/documents/mock-doc' },
    }),
  },
  operations: {
    get: jest.fn().mockResolvedValue({
      name: 'operations/mock',
      done: true,
      response: { documentName: 'fileSearchStores/mock/documents/mock-doc' },
    }),
  },
}));

module.exports = {
  GoogleGenAI
};
