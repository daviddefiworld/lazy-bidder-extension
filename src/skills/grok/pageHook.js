/**
 * Injected into Grok's MAIN world via chrome.scripting.executeScript.
 * Captures the streamed JSON body from new-conversation chat requests.
 */
(function lazybidderGrokFetchHook() {
  if (window.__lazybidderGrokFetchHook) return;
  window.__lazybidderGrokFetchHook = true;

  var GROK_CHAT_PATH = '/rest/app-chat/conversations/new';
  var originalFetch = window.fetch.bind(window);

  window.fetch = async function (input, init) {
    var url = '';
    if (typeof input === 'string') {
      url = input;
    } else if (input && typeof input === 'object') {
      if (typeof input.url === 'string') url = input.url;
      else if (typeof input.href === 'string') url = input.href;
    }

    var response = await originalFetch(input, init);
    if (String(url).indexOf(GROK_CHAT_PATH) !== -1) {
      try {
        var clone = response.clone();
        var body = await clone.text();
        window.postMessage(
          { source: 'lazybidder', kind: 'grokChatStream', url: String(url), body: body },
          '*'
        );
      } catch (e) {
        /* ignore read errors */
      }
    }
    return response;
  };
})();
