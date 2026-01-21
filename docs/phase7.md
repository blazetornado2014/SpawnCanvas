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
    -   Target: The container element wrapping the chat history (Need to identify this in Implementation).
    -   Action: When new text node appears -> `Memory.captureResponse`.

## 3. Shared Memory Store
-   **Structure**:
    ```javascript
    {
      "chatHistory": [
        {
          "id": "msg_123",
          "timestamp": 123456789,
          "role": "user",
          "content": "Make me a platformer game"
        },
        {
          "id": "msg_124",
          "timestamp": 123456799,
          "role": "ai",
          "content": "Here is the code for the platformer..."
        }
      ]
    }
    ```

## 4. Implementation Steps
1.  **Identify API Endpoint**: (User to provide Network Audit logs).
2.  **Create Integrator Script**:
    -   Inject a "world script" to intercept `window.fetch`.
    -   Pass data to the content script via `window.postMessage`.
3.  **App UI**:
    -   "Memory Tab" displays this chat log as a reference.
