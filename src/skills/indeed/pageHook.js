/**
 * Injected into Indeed's MAIN world via chrome.scripting.executeScript.
 * Inline <script> from the content script is blocked by site CSP; this file is not.
 */
(function lazybidderIndeedFetchHook() {
  if (window.__lazybidderFetchHook) return;
  window.__lazybidderFetchHook = true;

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
    if (String(url).indexOf('/viewjob') !== -1) {
      try {
        var clone = response.clone();
        var data = await clone.json();
        window.postMessage(
          { source: 'lazybidder', kind: 'viewjob', url: String(url), data: data },
          '*'
        );
      } catch (e) {
        /* ignore non-JSON or empty body */
      }
    }
    return response;
  };
})();
