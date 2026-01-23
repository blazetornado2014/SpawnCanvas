# Phase 7 Execution Plan (Spawn.co Memory Integration)

**Goal**: Automatically capture the user's prompts ("What do you want to play?") and the AI's responses from `spawn.co` to build a shared Memory.

## 1. Discovery Results (Revised)
-   **Hydration Data**: ❌ `__NEXT_DATA__` is NOT available (confirmed by audit).
-   **Input Selector**: ✅ Found `<textarea aria-label="What do you want to play?">`. This is our stable hook for capturing User Prompts.
-   **Network**: ⚠️ Initial logs only show telemetry (`/api/sdk/v1/...`). Chat API likely uses Streaming or WebSockets which are harder to intercept cleanly.
-   **Refined Strategy**:
    -   **Input**: Attach `keydown` (Enter) listener to the `aria-label` textarea.
    -   **Output**: Use `MutationObserver` to watch the chat container (above the input) for new incoming messages, as Network interception for streaming is complex.

## 2. Technical Approach: DOM Observer & Input Listener
### Content Script (`content/spawn-integrator.js`)
1.  **Input Listener**:
    -   Target: `textarea[aria-label="What do you want to play?"]`
    -   Action: On `Enter` (without Shift), capture value -> `Memory.draftPrompt`.
2.  **Output Observer**:
    -   Target: `div.scrollbar-simple.flex.w-full.flex-col.gap-2.overflow-y-auto.scroll-smooth` (The chat history container).
    -   Action: When new text node appears -> `Memory.captureResponse`.

## 3. Shared Memory Store & Linking
**Structure**:
```javascript
{
  // Global mapping of context
  "memories": {
    "project_123": {
      "title": "Super Game Project",
      "chatHistory": [ ... ]
    }
  }
}
```

**Workspace Linking Strategy**:
1.  **Detection**: The Integrator detects the Project ID from the URL (e.g., `spawn.co/play/super-game-123` -> `super-game-123`).
2.  **Association**:
    -   Each **Workspace** in `Store` gets a `linkedProjectId` field.
    -   When you open a workspace while on a Project Page:
        -   **If linked**: Automatically show memory for that project.
        -   **If not linked**: Show a "Link to this Project?" button in the Memory Tab.
        -   **If mismatch**: Show warning "This workspace is linked to Project X, but you are on Project Y."

## 4. Implementation Steps
1.  **Integrator**: Extract Project ID from URL. Pass it to App.
2.  **Store**: Update `Workspace` schema to include `linkedProjectId`.
3.  **UI**: Logic to compare `currentProject` (from URL) vs `workspace.linkedProject`.
