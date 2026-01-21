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
      model: 'gemini-2.5-flash'
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
   * Parse title from AI response (expects "TITLE: ..." on first line)
   * @param {string} content - Raw AI response
   * @returns {{ title: string|null, content: string }} Parsed title and remaining content
   */
  function parseTitle(content) {
    const lines = content.split('\n');
    let title = null;
    let startIndex = 0;

    // Check if first non-empty line starts with "TITLE:"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue;

      if (line.toUpperCase().startsWith('TITLE:')) {
        title = line.substring(6).trim();
        startIndex = i + 1;
      }
      break;
    }

    // Return remaining content without the title line
    const remainingContent = lines.slice(startIndex).join('\n').trim();
    return { title, content: remainingContent };
  }

  /**
   * Generate checklist items from a prompt
   * @param {string} userPrompt - The user's prompt
   * @param {string} apiKey - API key
   * @param {string} provider - Provider name ('claude', 'openai', 'gemini')
   * @param {string} customPrompt - Optional custom prompt template
   * @returns {Promise<{title: string|null, items: string[]}>} Generated title and items
   */
  async function generateChecklistItems(userPrompt, apiKey, provider = 'claude', customPrompt = null) {
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    if (!userPrompt || userPrompt.trim() === '') {
      throw new Error('Please enter a prompt');
    }

    // Get the prompt template - use custom if provided, otherwise fetch from PromptManager
    let promptTemplate = customPrompt;
    if (!promptTemplate && typeof PromptManager !== 'undefined') {
      promptTemplate = await PromptManager.getPrompt('checklist');
    }

    // Fallback to default if PromptManager isn't available
    if (!promptTemplate) {
      promptTemplate = `Generate a checklist based on this request: "{prompt}"

Rules:
- First line must be a short title (3-5 words) prefixed with "TITLE:"
- Then list the checklist items, one per line
- Each item should be a clear, actionable task
- Keep items concise (under 10 words each)
- Generate 5-10 relevant items
- Do not include numbers, bullets, or checkboxes
- Do not include any explanation`;
    }

    // Build the prompt with placeholder replaced
    const prompt = typeof PromptManager !== 'undefined'
      ? PromptManager.buildPrompt(promptTemplate, userPrompt)
      : promptTemplate.replace(/{prompt}/g, userPrompt);

    const rawContent = await callProvider(prompt, apiKey, provider);

    // Parse title and content
    const { title, content } = parseTitle(rawContent);

    // Parse the remaining content into individual items
    const items = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.length < 200);

    if (items.length === 0) {
      throw new Error('No items generated');
    }

    return { title, items };
  }

  /**
   * Expand a note with AI-generated content
   * @param {string} userPrompt - The user's prompt
   * @param {string} existingContent - Any existing content
   * @param {string} apiKey - API key
   * @param {string} provider - Provider name
   * @param {string} customPrompt - Optional custom prompt template
   * @returns {Promise<{title: string|null, content: string}>} Generated title and content
   */
  async function expandNote(userPrompt, existingContent, apiKey, provider = 'claude', customPrompt = null) {
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    if (!userPrompt || userPrompt.trim() === '') {
      throw new Error('Please enter a prompt');
    }

    // Get the prompt template - use custom if provided, otherwise fetch from PromptManager
    let promptTemplate = customPrompt;
    if (!promptTemplate && typeof PromptManager !== 'undefined') {
      promptTemplate = await PromptManager.getPrompt('note');
    }

    // Fallback to default if PromptManager isn't available
    if (!promptTemplate) {
      promptTemplate = `Write content based on this request: "{prompt}"

Rules:
- First line must be a short title (3-5 words) prefixed with "TITLE:"
- Then write the note content
- Keep it concise and useful
- Use plain text, no markdown
- 2-4 paragraphs maximum`;
    }

    // Build the prompt with placeholder replaced
    let prompt = typeof PromptManager !== 'undefined'
      ? PromptManager.buildPrompt(promptTemplate, userPrompt)
      : promptTemplate.replace(/{prompt}/g, userPrompt);

    // Append existing content if available
    if (existingContent && existingContent.trim()) {
      prompt += `\n\nExisting content to expand on:\n${existingContent}`;
    }

    const rawContent = await callProvider(prompt, apiKey, provider);

    // Parse title and content
    const { title, content } = parseTitle(rawContent);

    return { title, content };
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
