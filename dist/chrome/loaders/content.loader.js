(async () => {
  let scriptPath = '';
  const url = window.location.href;
  if (url.includes('claude.ai')) scriptPath = 'agents/claude/claude.content.js';
  else if (url.includes('chatgpt.com')) scriptPath = 'agents/chatgpt/chatgpt.content.js';
  else if (url.includes('gemini.google.com')) scriptPath = 'agents/gemini/gemini.content.js';
  else if (url.includes('x.com')) scriptPath = 'agents/grok/grok.content.js';

  if (scriptPath) {
    const src = chrome.runtime.getURL(scriptPath);
    await import(src);
  }
})();
