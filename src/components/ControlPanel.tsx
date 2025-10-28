import React, { useState, useRef, useEffect } from 'react';
import { ActionType, SelectorType, ActionConfig, ActionResult } from '../services/actionExecutor';

interface LogEntry {
  id: string;
  timestamp: Date;
  actionType: ActionType;
  config: ActionConfig;
  result: ActionResult;
}

interface ControlPanelProps {
  isRunning: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ isRunning }) => {
  const [actionType, setActionType] = useState<ActionType>('findElement');
  const [selectorType, setSelectorType] = useState<SelectorType>('css');
  const [selector, setSelector] = useState('');
  const [value, setValue] = useState('');
  const [waitTime, setWaitTime] = useState(1000);
  const [script, setScript] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [contentScriptStatus, setContentScriptStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  // Check content script status when component mounts or isRunning changes
  useEffect(() => {
    const checkContentScriptStatus = async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          console.log('Checking content script status for tab:', tabs[0].id);
          await chrome.tabs.sendMessage(tabs[0].id, { action: 'ping' });
          setContentScriptStatus('available');
          console.log('Content script is available');
        } else {
          setContentScriptStatus('unavailable');
          console.log('Content script is unavailable');
        }
      } catch (error) {
        setContentScriptStatus('unavailable');
      }
    };

    checkContentScriptStatus();
  }, [isRunning]);

  const clearLogs = () => {
    setLogs([]);
  };

  const executeAction = async () => {
    if (!isRunning) {
      alert('Extension must be running to execute actions');
      return;
    }

    setIsExecuting(true);

    const config: ActionConfig = {
      selector: selector || undefined,
      selectorType: selectorType,
      value: value || undefined,
      waitTime: waitTime,
      script: script || undefined,
    };

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        throw new Error('No active tab found');
      }

      // Check if content script is available with a ping
      try {
        await chrome.tabs.sendMessage(tabs[0].id, { action: 'ping' });
        setContentScriptStatus('available');
      } catch (error) {
        console.log('Content script not available:', error);
        setContentScriptStatus('unavailable');
        throw new Error('Content script is not available. Please refresh the page and try again.');
      }

      // Now execute the action
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'executeAction',
        actionType,
        config,
      });

      const logEntry: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        actionType,
        config,
        result: response || { success: false, error: 'No response received' },
      };

      setLogs(prev => [...prev, logEntry]);
    } catch (error) {
      const logEntry: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        actionType,
        config,
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };

      setLogs(prev => [...prev, logEntry]);
    } finally {
      setIsExecuting(false);
    }
  };

  const getActionIcon = (actionType: ActionType): string => {
    switch (actionType) {
      case 'click': return '🖱️';
      case 'input': return '⌨️';
      case 'select': return '📋';
      case 'wait': return '⏱️';
      case 'scroll': return '📜';
      case 'executeScript': return '⚡';
      case 'getText': return '📝';
      case 'getAttribute': return '🏷️';
      case 'findElement': return '🔍';
      case 'waitForElement': return '⏳';
      default: return '⚙️';
    }
  };

  const renderActionFields = () => {
    switch (actionType) {
      case 'click':
      case 'getText':
      case 'getAttribute':
      case 'findElement':
      case 'waitForElement':
        return (
          <>
            <div className="sidebar-action-field">
              <label className="sidebar-action-label">
                Selector Type
                <select
                  value={selectorType}
                  onChange={(e) => setSelectorType(e.target.value as SelectorType)}
                  className="sidebar-action-select"
                >
                  <option value="css">CSS Selector</option>
                  <option value="id">ID</option>
                  <option value="className">Class Name</option>
                  <option value="xpath">XPath</option>
                  <option value="text">Text Content</option>
                </select>
              </label>
            </div>
            <div className="sidebar-action-field">
              <label className="sidebar-action-label">
                Selector
                <input
                  type="text"
                  value={selector}
                  onChange={(e) => setSelector(e.target.value)}
                  placeholder="Enter selector..."
                  className="sidebar-action-input"
                />
              </label>
              <div className="sidebar-action-description">
                {selectorType === 'css' && 'CSS selector (e.g., .button, #submit)'}
                {selectorType === 'id' && 'Element ID (e.g., submit-btn)'}
                {selectorType === 'className' && 'CSS class name (e.g., btn-primary)'}
                {selectorType === 'xpath' && 'XPath expression (e.g., //button[@type="submit"])'}
                {selectorType === 'text' && 'Exact text content of the element'}
              </div>
            </div>
            {actionType === 'waitForElement' && (
              <div className="sidebar-action-field">
                <label className="sidebar-action-label">
                  Wait Time (ms)
                  <input
                    type="number"
                    value={waitTime}
                    onChange={(e) => setWaitTime(Number(e.target.value))}
                    min="100"
                    max="30000"
                    step="100"
                    className="sidebar-action-input"
                  />
                </label>
              </div>
            )}
            {actionType === 'getAttribute' && (
              <div className="sidebar-action-field">
                <label className="sidebar-action-label">
                  Attribute Name
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="e.g., href, src, data-value"
                    className="sidebar-action-input"
                  />
                </label>
              </div>
            )}
          </>
        );

      case 'input':
        return (
          <>
            <div className="sidebar-action-field">
              <label className="sidebar-action-label">
                Selector Type
                <select
                  value={selectorType}
                  onChange={(e) => setSelectorType(e.target.value as SelectorType)}
                  className="sidebar-action-select"
                >
                  <option value="css">CSS Selector</option>
                  <option value="id">ID</option>
                  <option value="className">Class Name</option>
                  <option value="xpath">XPath</option>
                </select>
              </label>
            </div>
            <div className="sidebar-action-field">
              <label className="sidebar-action-label">
                Selector
                <input
                  type="text"
                  value={selector}
                  onChange={(e) => setSelector(e.target.value)}
                  placeholder="Enter selector..."
                  className="sidebar-action-input"
                />
              </label>
            </div>
            <div className="sidebar-action-field">
              <label className="sidebar-action-label">
                Input Value
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Enter text to input..."
                  className="sidebar-action-input"
                />
              </label>
            </div>
          </>
        );

      case 'select':
        return (
          <>
            <div className="sidebar-action-field">
              <label className="sidebar-action-label">
                Selector Type
                <select
                  value={selectorType}
                  onChange={(e) => setSelectorType(e.target.value as SelectorType)}
                  className="sidebar-action-select"
                >
                  <option value="css">CSS Selector</option>
                  <option value="id">ID</option>
                  <option value="className">Class Name</option>
                  <option value="xpath">XPath</option>
                </select>
              </label>
            </div>
            <div className="sidebar-action-field">
              <label className="sidebar-action-label">
                Selector
                <input
                  type="text"
                  value={selector}
                  onChange={(e) => setSelector(e.target.value)}
                  placeholder="Enter selector..."
                  className="sidebar-action-input"
                />
              </label>
            </div>
            <div className="sidebar-action-field">
              <label className="sidebar-action-label">
                Option Value
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Enter option value..."
                  className="sidebar-action-input"
                />
              </label>
            </div>
          </>
        );

      case 'wait':
        return (
          <div className="sidebar-action-field">
            <label className="sidebar-action-label">
              Wait Time (ms)
              <input
                type="number"
                value={waitTime}
                onChange={(e) => setWaitTime(Number(e.target.value))}
                min="100"
                max="30000"
                step="100"
                className="sidebar-action-input"
              />
            </label>
          </div>
        );

      case 'scroll':
        return (
          <>
            <div className="sidebar-action-field">
              <label className="sidebar-action-label">
                Scroll Type
                <select
                  value={selector ? 'element' : 'position'}
                  onChange={(e) => {
                    if (e.target.value === 'position') {
                      setSelector('');
                    }
                  }}
                  className="sidebar-action-select"
                >
                  <option value="position">Scroll to Position</option>
                  <option value="element">Scroll to Element</option>
                </select>
              </label>
            </div>
            {selector ? (
              <>
                <div className="sidebar-action-field">
                  <label className="sidebar-action-label">
                    Selector Type
                    <select
                      value={selectorType}
                      onChange={(e) => setSelectorType(e.target.value as SelectorType)}
                      className="sidebar-action-select"
                    >
                      <option value="css">CSS Selector</option>
                      <option value="id">ID</option>
                      <option value="className">Class Name</option>
                      <option value="xpath">XPath</option>
                    </select>
                  </label>
                </div>
                <div className="sidebar-action-field">
                  <label className="sidebar-action-label">
                    Selector
                    <input
                      type="text"
                      value={selector}
                      onChange={(e) => setSelector(e.target.value)}
                      placeholder="Enter selector..."
                      className="sidebar-action-input"
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <div className="sidebar-action-field">
                  <label className="sidebar-action-label">
                    X Position
                    <input
                      type="number"
                      value={value.split(',')[0] || ''}
                      onChange={(e) => {
                        const y = value.split(',')[1] || '';
                        setValue(`${e.target.value},${y}`);
                      }}
                      placeholder="0"
                      className="sidebar-action-input"
                    />
                  </label>
                </div>
                <div className="sidebar-action-field">
                  <label className="sidebar-action-label">
                    Y Position
                    <input
                      type="number"
                      value={value.split(',')[1] || ''}
                      onChange={(e) => {
                        const x = value.split(',')[0] || '';
                        setValue(`${x},${e.target.value}`);
                      }}
                      placeholder="0"
                      className="sidebar-action-input"
                    />
                  </label>
                </div>
              </>
            )}
          </>
        );

      case 'executeScript':
        return (
          <div className="sidebar-action-field">
            <label className="sidebar-action-label">
              JavaScript Code
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Enter JavaScript code to execute..."
                rows={4}
                className="sidebar-action-textarea"
              />
            </label>
            <div className="sidebar-action-description">
              Execute custom JavaScript code in the page context
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="sidebar-action-controller">
      <div className="sidebar-action-header">
        <h3 className="sidebar-action-title">Action Control Panel</h3>
        <div className="flex items-center gap-2">
          <div className={`sidebar-action-status-indicator ${isRunning ? 'connected' : 'disconnected'}`}>
            {isRunning ? '🟢' : '🔴'}
          </div>
          <div className={`sidebar-action-status-indicator ${
            contentScriptStatus === 'available' ? 'connected' : 
            contentScriptStatus === 'checking' ? 'disconnected' : 'disconnected'
          }`}>
            {contentScriptStatus === 'available' ? '📄' : 
             contentScriptStatus === 'checking' ? '⏳' : '❌'}
          </div>
        </div>
      </div>

      <div className="sidebar-action-form">
        <div className="sidebar-action-field">
          <label className="sidebar-action-label">
            Action Type
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as ActionType)}
              className="sidebar-action-select"
            >
              <option value="findElement">Find Element</option>
              <option value="click">Click</option>
              <option value="input">Input Text</option>
              <option value="select">Select Option</option>
              <option value="wait">Wait</option>
              <option value="scroll">Scroll</option>
              <option value="executeScript">Execute Script</option>
              <option value="getText">Get Text</option>
              <option value="getAttribute">Get Attribute</option>
              <option value="waitForElement">Wait for Element</option>
            </select>
          </label>
        </div>

        {renderActionFields()}

        <button
          onClick={executeAction}
          disabled={isExecuting || !isRunning || contentScriptStatus === 'unavailable'}
          className="sidebar-action-execute-button"
        >
          {isExecuting ? 'Executing...' : 
           contentScriptStatus === 'unavailable' ? 'Content Script Unavailable' :
           `Execute ${getActionIcon(actionType)} ${actionType}`}
        </button>
      </div>

      {/* Log Display */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            Action Log ({logs.length})
          </h4>
          {logs.length > 0 && (
            <button
              onClick={clearLogs}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear Logs
            </button>
          )}
        </div>

        <div className="sidebar-action-list">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No actions executed yet
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="sidebar-action-item">
                <div className="sidebar-action-item-header">
                  <div className="sidebar-action-item-main">
                    <span className="sidebar-action-icon">{getActionIcon(log.actionType)}</span>
                    <div className="sidebar-action-item-info">
                      <div className="sidebar-action-type">{log.actionType}</div>
                      <div className="sidebar-action-time">
                        {log.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`sidebar-action-status ${
                      log.result.success
                        ? 'sidebar-action-status-completed'
                        : 'sidebar-action-status-failed'
                    }`}
                  >
                    {log.result.success ? 'Success' : 'Failed'}
                  </span>
                </div>

                <div className="sidebar-action-item-details">
                  <div className="sidebar-action-detail-section">
                    <div className="sidebar-action-detail-title">Configuration</div>
                    <div className="sidebar-action-detail-content">
                      {log.config.selector && (
                        <div className="sidebar-action-detail-item">
                          <span className="sidebar-action-detail-label">Selector:</span>
                          <code className="sidebar-action-detail-value">{log.config.selector}</code>
                        </div>
                      )}
                      {log.config.selectorType && (
                        <div className="sidebar-action-detail-item">
                          <span className="sidebar-action-detail-label">Type:</span>
                          <span className="sidebar-action-detail-value">{log.config.selectorType}</span>
                        </div>
                      )}
                      {log.config.value && (
                        <div className="sidebar-action-detail-item">
                          <span className="sidebar-action-detail-label">Value:</span>
                          <span className="sidebar-action-detail-value">{log.config.value}</span>
                        </div>
                      )}
                      {log.config.waitTime && (
                        <div className="sidebar-action-detail-item">
                          <span className="sidebar-action-detail-label">Wait Time:</span>
                          <span className="sidebar-action-detail-value">{log.config.waitTime}ms</span>
                        </div>
                      )}
                      {log.config.script && (
                        <div className="sidebar-action-detail-item">
                          <span className="sidebar-action-detail-label">Script:</span>
                          <code className="sidebar-action-detail-value">{log.config.script}</code>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="sidebar-action-detail-section">
                    <div className="sidebar-action-detail-title">Result</div>
                    {log.result.success ? (
                      <div className="sidebar-action-result">
                        {typeof log.result.result === 'object'
                          ? JSON.stringify(log.result.result, null, 2)
                          : String(log.result.result)}
                      </div>
                    ) : (
                      <div className="sidebar-action-error">
                        {log.result.error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
