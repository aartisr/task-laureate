import { createGeminiFreeTierProvider } from './geminiFreeTier.mjs';

/** Explicit composition root. Adding a vendor is one adapter and one registry entry. */
export function createAiProposalProvider(config) {
  if (config.provider === 'gemini-free-preview') return createGeminiFreeTierProvider({ apiKey: config.geminiKey, model: config.model });
  return null;
}
