import './content.css';
import { handleContentMessage } from './actions';
import { isToContentMessage } from '../types/messages';

const TAG_ROOT_ID = 'lazybidder-notification';

/** Small on-page badge so you can confirm the content script injected. */
function mountLazyBidderTag(): void {
  console.log("lazybidder mount tag started")
  if (document.getElementById(TAG_ROOT_ID)) {
    return;
  }

  const root = document.createElement('div');
  root.id = TAG_ROOT_ID;
  root.setAttribute('aria-label', 'LazyBidder content script active');

  const widget = document.createElement('div');
  widget.className = 'lazybidder-widget';

  const status = document.createElement('span');
  status.className = 'lazybidder-status connected';
  status.setAttribute('aria-hidden', 'true');
  status.textContent = '●';

  const title = document.createElement('span');
  title.className = 'lazybidder-title';
  title.textContent = 'LazyBidder';

  widget.append(status, title);
  root.append(widget);
  document.documentElement.appendChild(root);

  console.log("lazybidder mount tag ended")
}

mountLazyBidderTag();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isToContentMessage(message)) {
    return;
  }
  return handleContentMessage(message, sender, sendResponse);
});

console.log('LazyBidder: Indeed content script ready');
