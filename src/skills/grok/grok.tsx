import React, { useState } from 'react';
import { actionCoordinator } from '../../utils/actionCoordinator';
import { GROK_ACTION } from './grokShared';
import type { GrokChatResult } from './types';

const GROK_HOME = 'https://grok.com/';
const GROK_TAB_MATCH = '*://grok.com/*';

/**
 * Grok automation for dashboard orders and sidebar test sends.
 * Orders use grok.com only (not x.com) so navigation is deterministic.
 */
export class GrokSkill {
  readonly id = 'grok';

  /** Focus an existing grok.com tab or open a new one. */
  async ensureGrokTabForOrder(): Promise<number> {
    const tabs = await chrome.tabs.query({ url: GROK_TAB_MATCH });
    const first = tabs[0];
    if (first?.id != null) {
      await chrome.tabs.update(first.id, { active: true });
      return first.id;
    }
    const tab = await chrome.tabs.create({ url: GROK_HOME, active: true });
    if (!tab.id) throw new Error('Failed to open Grok tab');
    return tab.id;
  }

  async sendPrompt(prompt: string): Promise<GrokChatResult> {
    const text = prompt.trim();
    if (!text) throw new Error('Prompt is empty');

    actionCoordinator.ensureListener();
    const tabId = await this.ensureGrokTabForOrder();
    await actionCoordinator.waitForTabReady(tabId);

    return actionCoordinator.dispatch<GrokChatResult>(tabId, GROK_ACTION, { prompt: text });
  }
}

const grokSkill = new GrokSkill();

export function getGrokSkill(): GrokSkill {
  return grokSkill;
}

/** Local test send from sidebar (no server order id). */
export const GrokTestPanel: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GrokChatResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await grokSkill.sendPrompt(text));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sidebar-status space-y-3">
      <span className="sidebar-status-label">Test message (local)</span>
      <p className="text-xs text-gray-500">
        Sends from this browser without creating a dashboard order.
      </p>
      <textarea
        className="auth-input min-h-[72px] resize-y text-sm"
        placeholder="Try a prompt on Grok…"
        value={prompt}
        disabled={busy}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void send();
          }
        }}
      />
      <button
        type="button"
        className="auth-button"
        disabled={busy || !prompt.trim()}
        onClick={() => void send()}
      >
        {busy ? 'Waiting…' : 'Send test'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {result && (
        <pre className="text-xs text-gray-800 whitespace-pre-wrap break-words font-sans max-h-40 overflow-auto border border-gray-100 rounded-lg p-2">
          {result.message}
        </pre>
      )}
    </div>
  );
};
