# Phase 6 Execution Plan (AI Customization)

**Goal**: Empower users to customize the AI's behavior by modifying system prompts and settings directly from the UI.

## 1. System Prompt Management
**Problem**: Prompts are currently hardcoded in `ai-service.js`. Users cannot tweak them to fit their specific workflow (e.g., "Make the checklist funny" or "Use strict professional tone").
**Solution**: Extract prompts into a dedicated `PromptManager` and expose them via the Settings UI.

### Execution Steps
1.  **Architecture**:
    -   Create `canvas/core/prompts.js` to store default prompts (Checklist Generation, Note Expansion).
    -   Update `Store` to persist user-overridden prompts.
2.  **UI**:
    -   Add a "Prompts" tab to the Settings Modal.
    -   Display text areas for each prompt type (Checklist, Note).
    -   Add "Reset to Default" button.
3.  **Integration**:
    -   Update `ai-service.js` to accept `systemPrompt` as an argument or fetch it from `Store`.

## 2. Refine Settings UI
**Goal**: Ensure the Settings UI is robust enough to handle API Keys (Phase 5) and Prompts (Phase 6).
**Status**: *To be verified/built in Phase 5.*
