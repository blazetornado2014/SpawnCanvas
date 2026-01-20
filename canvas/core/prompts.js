/**
 * Prompt Manager - Manages custom AI prompts
 * Provides default prompts and get/set interface for customization
 */

const PromptManager = (function() {
  'use strict';

  // Default prompts
  const DEFAULTS = {
    checklist: `Generate a checklist based on this request: "{prompt}"

Rules:
- Return ONLY the checklist items, one per line
- Each item should be a clear, actionable task
- Keep items concise (under 10 words each)
- Generate 5-10 relevant items
- Do not include numbers, bullets, or checkboxes
- Do not include any explanation or preamble`,

    note: `Write content based on this request: "{prompt}"

Rules:
- Keep it concise and useful
- Use plain text, no markdown
- 2-4 paragraphs maximum
- Be informative and relevant to the request`
  };

  /**
   * Get a prompt by type
   * @param {string} type - 'checklist' or 'note'
   * @returns {Promise<string>} The prompt template
   */
  async function getPrompt(type) {
    if (type === 'checklist') {
      const custom = await Store.getChecklistPrompt();
      return custom || DEFAULTS.checklist;
    } else if (type === 'note') {
      const custom = await Store.getNotePrompt();
      return custom || DEFAULTS.note;
    }
    return DEFAULTS[type] || '';
  }

  /**
   * Set a custom prompt
   * @param {string} type - 'checklist' or 'note'
   * @param {string} prompt - The custom prompt template
   * @returns {Promise<boolean>} Success
   */
  async function setPrompt(type, prompt) {
    if (type === 'checklist') {
      return Store.setChecklistPrompt(prompt);
    } else if (type === 'note') {
      return Store.setNotePrompt(prompt);
    }
    return false;
  }

  /**
   * Reset a prompt to its default value
   * @param {string} type - 'checklist' or 'note'
   * @returns {Promise<boolean>} Success
   */
  async function resetToDefault(type) {
    if (type === 'checklist') {
      return Store.setChecklistPrompt(null);
    } else if (type === 'note') {
      return Store.setNotePrompt(null);
    }
    return false;
  }

  /**
   * Get the default prompt for a type
   * @param {string} type - 'checklist' or 'note'
   * @returns {string} The default prompt
   */
  function getDefault(type) {
    return DEFAULTS[type] || '';
  }

  /**
   * Build a prompt with the placeholder replaced
   * @param {string} template - The prompt template
   * @param {string} userPrompt - The user's prompt to insert
   * @returns {string} The completed prompt
   */
  function buildPrompt(template, userPrompt) {
    return template.replace(/{prompt}/g, userPrompt);
  }

  return {
    getPrompt,
    setPrompt,
    resetToDefault,
    getDefault,
    buildPrompt,
    DEFAULTS
  };

})();

window.PromptManager = PromptManager;
