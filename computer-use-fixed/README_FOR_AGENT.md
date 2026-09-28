# PROFESSOR-XMD — Full Project Context

## What this project is
PROFESSOR-XMD is a computer-use AI agent UI:
- Backend: Node.js + Express + E2B SDK + OpenHands SDK v1.46.0
- Frontend: React 19 + Vite + Tailwind v4 + Motion + custom animations
- Protocol: AG-UI SSE

## Architecture flow
1. User types in Chat UI
2. UI POSTs to server.ts
3. server.ts creates E2B sandbox, runs OpenHands
4. OpenHands writes events to /tmp/openhands-events.jsonl
5. server.ts polls, translates to AG-UI SSE
6. SSE streams via /events endpoint
7. openhands-to-timeline.ts converts events → TimelineItem[]
8. Chat.tsx renders using animation components

## Events emitted
- SystemPromptEvent (internal, skipped)
- MessageEvent (user/assistant, with reasoning_content)
- ActionEvent (agent decides tool)
- ObservationEvent (tool result, with optional screenshot_data)
- OpenHandsRunFinished / OpenHandsRunError
- ConversationErrorEvent / AgentErrorEvent

## Tool names
- terminal — shell commands
- file_editor — create, view, str_replace, insert, undo_edit
- think — reasoning
- browser_navigate, browser_get_state, browser_get_content, browser_click, browser_type, browser_scroll
- finish — agent decides done

## ActionEvent format
{
  "event_type": "ActionEvent",
  "data": {
    "tool_name": "terminal",
    "tool_call_id": "call_abc123",
    "reasoning_content": "agent thoughts...",
    "action": { "command": "pwd", "kind": "TerminalAction" },
    "summary": "terminal: {\"command\": \"pwd\"}"
  }
}

## ObservationEvent format
{
  "event_type": "ObservationEvent",
  "data": {
    "tool_name": "terminal",
    "tool_call_id": "call_abc123",
    "observation": {
      "content": [{"type": "text", "text": "output"}],
      "is_error": false,
      "exit_code": 0,
      "screenshot_data": "iVBORw0KGgo..." (base64 PNG for browser_get_state)
    }
  }
}

## Existing components (agent-anim/)
51 components: primitives, tool cards, task/control, chrome.

## Known problems
1. Real-time streaming missing (animations arrive after event completes)
2. Thought streaming not working (reasoning_content shown static)
3. Thinking card not showing during thinking
4. Status indicators missing (success/error/wrong states)
5. Summary text never shown
6. Some actions lack animation (browser_*, MCP)
7. Chat UI design needs full redesign
8. Agent doesn't know its own tools

## Integration rules
- Do NOT change shape/design of existing animation components
- Do NOT change backend event protocol
- Focus: real-time streaming, missing animations, chat redesign, agent self-awareness
