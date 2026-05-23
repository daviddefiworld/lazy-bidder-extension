import React, { useEffect, useState } from 'react';
import { useSidebarSocket } from '../hooks';
import { GrokTestPanel } from '../skills/grok/grok';
import { buildIndeedSearchUrl } from '../skills/indeed/indeedShared';
import {
  connectionSettings,
  DEFAULT_BACKEND_URL
} from '../config/ConnectionSettingsStore';
import './sidebar.css';

type SidebarToolSection = 'grok' | 'indeed';

const SidebarPage: React.FC = () => {
  const { socketConnected, connectError, orderState } = useSidebarSocket();
  const [toolSection, setToolSection] = useState<SidebarToolSection>('grok');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backendUrlInput, setBackendUrlInput] = useState(DEFAULT_BACKEND_URL);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await connectionSettings.read();
      setBackendUrlInput(s.backendUrl);
      setHasSavedApiKey(s.apiKey.trim().length > 0);
    })();
  }, []);

  const orderStatusLabel = () => {
    switch (orderState.phase) {
      case 'idle':
        return 'No order';
      case 'running':
        if (orderState.site === 'grok') {
          return 'Grok order running…';
        }
        return `Indeed: ${orderState.jobsFound} job${orderState.jobsFound === 1 ? '' : 's'} found`;
      case 'stopped':
        return 'Stopped';
      case 'completed':
        if (orderState.site === 'grok' && orderState.error) {
          return 'Grok order failed';
        }
        if (orderState.site === 'grok') {
          return 'Grok order completed';
        }
        return 'Completed';
    }
  };

  return (
    <div className="sidebar-container sidebar-main sidebar-slide-in flex flex-col h-full min-h-0">
      <div className="sidebar-header shrink-0">
        <h1 className="sidebar-header-title">LazyBidder</h1>
        <p className="sidebar-header-subtitle">Extension</p>
      </div>

      <div className="sidebar-tab-panel p-4 space-y-4 flex-1 min-h-0 overflow-auto" role="main">
        <div className="sidebar-status">
          <div className="sidebar-status-item">
            <span className="sidebar-status-label">Connection</span>
            <span
              className={`sidebar-status-badge ${
                socketConnected ? 'sidebar-status-connected' : 'sidebar-status-disconnected'
              }`}
            >
              {socketConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {connectError && (
            <p className="text-xs text-amber-800 mt-2 leading-snug" title={connectError}>
              {connectError}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white/90 shrink-0 overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50"
            onClick={() => setSettingsOpen((o) => !o)}
            aria-expanded={settingsOpen}
          >
            <span>Backend &amp; API key</span>
            <span className="text-gray-400">{settingsOpen ? '▾' : '▸'}</span>
          </button>
          {settingsOpen && (
            <div className="px-3 pb-3 pt-0 space-y-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 pt-2">
                Create an API key in the dashboard (<strong>API keys</strong>), then paste it here. Same key
                authorizes the socket and any REST calls.
              </p>
              <div className="auth-input-group">
                <label className="auth-label" htmlFor="lb-backend-url">
                  Backend URL
                </label>
                <input
                  id="lb-backend-url"
                  className="auth-input text-sm py-2"
                  value={backendUrlInput}
                  onChange={(e) => setBackendUrlInput(e.target.value)}
                  placeholder={DEFAULT_BACKEND_URL}
                  autoComplete="off"
                />
              </div>
              <div className="auth-input-group">
                <label className="auth-label" htmlFor="lb-api-key">
                  API key
                </label>
                <input
                  id="lb-api-key"
                  type="password"
                  className="auth-input text-sm py-2 font-mono"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={hasSavedApiKey ? '•••••••• (enter new key to replace)' : 'lbk_…'}
                  autoComplete="off"
                />
                {hasSavedApiKey && !apiKeyInput && (
                  <p className="text-xs text-emerald-700">A key is saved on this device.</p>
                )}
              </div>
              {settingsError && <p className="text-xs text-red-600">{settingsError}</p>}
              {settingsMessage && <p className="text-xs text-emerald-700">{settingsMessage}</p>}
              <button
                type="button"
                className="auth-button py-2 text-sm"
                disabled={savingSettings}
                onClick={() => {
                  void (async () => {
                    setSettingsError(null);
                    setSettingsMessage(null);
                    const current = await connectionSettings.read();
                    const nextKey = apiKeyInput.trim() || current.apiKey;
                    if (!nextKey.trim()) {
                      setSettingsError('API key is required.');
                      return;
                    }
                    setSavingSettings(true);
                    try {
                      await connectionSettings.save(backendUrlInput, nextKey);
                      setHasSavedApiKey(true);
                      setApiKeyInput('');
                      setSettingsMessage('Saved. Reconnecting…');
                    } catch (e) {
                      setSettingsError(e instanceof Error ? e.message : 'Save failed');
                    } finally {
                      setSavingSettings(false);
                    }
                  })();
                }}
              >
                {savingSettings ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        <div className="sidebar-status">
          <div className="sidebar-status-item">
            <span className="sidebar-status-label">Order</span>
            <span
              className={`sidebar-status-badge ${
                orderState.phase === 'running' || orderState.phase === 'completed'
                  ? 'sidebar-status-connected'
                  : 'sidebar-status-disconnected'
              }`}
            >
              {orderStatusLabel()}
            </span>
          </div>
          {orderState.orderId && (
            <p className="text-xs text-gray-500 mt-2 font-mono truncate" title={orderState.orderId}>
              {orderState.orderId.slice(0, 10)}…
            </p>
          )}
          {orderState.site === 'indeed' && orderState.phase === 'running' && orderState.jobsScraped > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Scraped {orderState.jobsScraped} of {orderState.jobsFound} jobs on this page
            </p>
          )}
          {orderState.site === 'grok' && orderState.grokMessage && (
            <p className="text-xs text-gray-600 mt-2 line-clamp-3" title={orderState.grokMessage}>
              Message: {orderState.grokMessage}
            </p>
          )}
          {orderState.site === 'grok' && orderState.grokReply && (
            <div className="mt-2 max-h-32 overflow-auto rounded border border-gray-100 p-2 bg-white">
              <p className="text-xs font-semibold text-gray-700 mb-1">Reply</p>
              <p className="text-xs text-gray-800 whitespace-pre-wrap break-words">{orderState.grokReply}</p>
            </div>
          )}
          {orderState.error && (
            <p className="text-xs text-red-600 mt-2">{orderState.error}</p>
          )}
        </div>

        <div className="flex rounded-lg border border-gray-200 bg-gray-50/80 p-1 gap-1 shrink-0">
          <button
            type="button"
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
              toolSection === 'grok'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setToolSection('grok')}
          >
            Grok
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
              toolSection === 'indeed'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setToolSection('indeed')}
          >
            Indeed
          </button>
        </div>

        {toolSection === 'grok' ? (
          <GrokTestPanel />
        ) : (
          <div className="sidebar-status space-y-3 shrink-0">
            <span className="sidebar-status-label">Indeed jobs</span>
            <p className="text-xs text-gray-500">
              Job scrapes are queued from the LazyBidder dashboard. Use Grok above for a local test message
              without a dashboard order.
            </p>
            <button
              type="button"
              className="auth-button"
              onClick={() => {
                const url = buildIndeedSearchUrl(
                  { query: 'software', location: 'remote', sort: 'date', fromage: '7' },
                  0
                );
                void chrome.tabs.create({ url });
              }}
            >
              Open Indeed (sample search)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SidebarPage;
