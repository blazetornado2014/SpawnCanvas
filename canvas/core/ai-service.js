/**
 * AI Service - Multi-provider AI Integration
 * Supports: Anthropic Claude, OpenAI, Google Gemini
 */

const AIService = (function () {
  'use strict';

  // Provider configurations
  const PROVIDERS = {
    claude: {
      name: 'Claude',
      url: 'https://api.anthropic.com/v1/messages',
      model: 'claude-sonnet-4-20250514'
    },
    openai: {
      name: 'OpenAI',
      url: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini'
    },
    gemini: {
      name: 'Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
      model: 'gemini-2.0-flash'
    }
  };

  /**
   * Call Claude API
   */
  async function callClaude(prompt, apiKey) {
    const response = await fetch(PROVIDERS.claude.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: PROVIDERS.claude.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error('Invalid API key');
      if (response.status === 429) throw new Error('Rate limited - please wait');
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  /**
   * Call OpenAI API
   */
  async function callOpenAI(prompt, apiKey) {
    const response = await fetch(PROVIDERS.openai.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: PROVIDERS.openai.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error('Invalid API key');
      if (response.status === 429) throw new Error('Rate limited - please wait');
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Call Gemini API
   */
  async function callGemini(prompt, apiKey) {
    const url = `${PROVIDERS.gemini.baseUrl}/${PROVIDERS.gemini.model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1024
        }
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 400 || response.status === 403) throw new Error('Invalid API key');
      if (response.status === 429) throw new Error('Rate limited - please wait');
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Call the appropriate provider
   */
  async function callProvider(prompt, apiKey, provider) {
    switch (provider) {
      case 'openai':
        return callOpenAI(prompt, apiKey);
      case 'gemini':
        return callGemini(prompt, apiKey);
      case 'claude':
      default:
        return callClaude(prompt, apiKey);
    }
  }

  /**
   * Generate checklist items from a title/prompt
   * @param {string} title - The checklist title or prompt
   * @param {string} apiKey - API key
   * @param {string} provider - Provider name ('claude', 'openai', 'gemini')
   * @returns {Promise<string[]>} Array of checklist item texts
   */
  async function generateChecklistItems(title, apiKey, provider = 'claude') {
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    if (!title || title.trim() === '') {
      throw new Error('Please enter a title first');
    }

    const prompt = `Generate a checklist of actionable items for: "${title}"

Rules:
- Return ONLY the checklist items, one per line
- Each item should be a clear, actionable task
- Keep items concise (under 10 words each)
- Generate 5-10 items
- Do not include numbers, bullets, or checkboxes
- Do not include any explanation or preamble`;

    const content = await callProvider(prompt, apiKey, provider);

    // Parse the response into individual items
    const items = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.length < 200);

    if (items.length === 0) {
      throw new Error('No items generated');
    }

    return items;
  }

  /**
   * Expand a note with AI-generated content
   * @param {string} title - The note title
   * @param {string} existingContent - Any existing content
   * @param {string} apiKey - API key
   * @param {string} provider - Provider name
   * @returns {Promise<string>} Generated content
   */
  async function expandNote(title, existingContent, apiKey, provider = 'claude') {
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    if (!title || title.trim() === '') {
      throw new Error('Please enter a title first');
    }

    let prompt = `Write content for a note titled: "${title}"`;

    if (existingContent && existingContent.trim()) {
      prompt += `\n\nExisting content to expand on:\n${existingContent}`;
    }

    prompt += `\n\nRules:
- Keep it concise and useful
- Use plain text, no markdown
- 2-4 paragraphs maximum`;

    return callProvider(prompt, apiKey, provider);
  }

  /**
   * Get available providers
   */
  function getProviders() {
    return Object.entries(PROVIDERS).map(([id, config]) => ({
      id,
      name: config.name
    }));
  }

  return {
    generateChecklistItems,
    expandNote,
    getProviders
  };

})();

window.AIService = AIService;
