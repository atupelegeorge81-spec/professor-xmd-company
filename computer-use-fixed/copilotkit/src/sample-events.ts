// Auto-generated from sample-events/openhands-events.jsonl for the in-app
// replay demo (see ReplaySample.tsx). The first dozen events are the real
// recorded run exactly as provided; a handful of clearly-labelled synthetic
// events are appended afterwards purely so the demo can also show the
// timeout / MCP-without-ActionEvent / finish-message fixes end-to-end,
// since the real recording was truncated before those occurred.
export const SAMPLE_EVENTS: any[] = [
  {
    "type": "RUN_STARTED",
    "threadId": "1bd7597e-3d25-4716-89a0-e30b838f552e",
    "runId": "9526f54c-e071-4191-b798-04fe4696a1d1"
  },
  {
    "type": "TEXT_MESSAGE_START",
    "messageId": "9526f54c-e071-4191-b798-04fe4696a1d1-system",
    "role": "assistant"
  },
  {
    "type": "TEXT_MESSAGE_CONTENT",
    "messageId": "9526f54c-e071-4191-b798-04fe4696a1d1-system",
    "delta": "Sandbox i2zzqfiwlnlpa5n0cgh41 ready. Starting OpenHands..."
  },
  {
    "type": "TEXT_MESSAGE_END",
    "messageId": "9526f54c-e071-4191-b798-04fe4696a1d1-system"
  },
  {
    "type": "CUSTOM",
    "name": "OPENHANDS_EVENT",
    "value": {
      "eventType": "MessageEvent",
      "toolCallId": "",
      "timestamp": "2026-09-13T05:51:52.489336",
      "data": {
        "id": "b82780d0-04da-4931-b826-900c30922a2c",
        "timestamp": "2026-09-13T05:51:52.489336",
        "source": "user",
        "parent_id": "0ac5f3d5-1904-47ca-bd64-cee40c466ad7",
        "llm_message": {
          "role": "user",
          "content": [
            {
              "cache_prompt": false,
              "type": "text",
              "text": "Your mission:  1. Research modern login page designs from 2026. Search online for inspiration — you have a search tool available (use whatever tool fits: browser_navigate, browser_get_content, or MCP search). Read multiple sources.  2. Based on your research, build a modern login page at /code/project/login-app/index.html. It should look professional and current — use whatever design approach you think fits best (glassmorphism, gradients, minimal, dark theme, etc.). Include email input, password input, and a submit button.  3. Start a local server on port 8080 to host the page.  4. Open the page in your browser, scroll through it, take screenshots, and honestly evaluate: does it look modern and correct? If not, improve it and verify again.  5. Report what you built, what you learned from research, and your final assessment of the design.  Work autonomously. Use any tools available to you."
            }
          ],
          "thinking_blocks": []
        },
        "activated_skills": [],
        "extended_content": [],
        "kind": "MessageEvent"
      }
    }
  },
  {
    "type": "CUSTOM",
    "name": "OPENHANDS_EVENT",
    "value": {
      "eventType": "ActionEvent",
      "toolCallId": "call_ee9e0ca8fc1b4ec5b68ca4a6",
      "timestamp": "2026-09-13T05:51:57.315696",
      "data": {
        "id": "778106d2-6a43-42a0-a464-ba58b8823844",
        "timestamp": "2026-09-13T05:51:57.315696",
        "source": "agent",
        "parent_id": "8687ceb1-40e2-421b-8b49-917ea3cdcdda",
        "thought": [],
        "thinking_blocks": [],
        "action": {
          "command": "ls -la /code/project && python3 --version && which python3",
          "is_input": false,
          "reset": false,
          "kind": "TerminalAction"
        },
        "tool_name": "terminal",
        "tool_call_id": "call_ee9e0ca8fc1b4ec5b68ca4a6",
        "tool_call": {
          "id": "call_ee9e0ca8fc1b4ec5b68ca4a6",
          "name": "terminal",
          "arguments": "{\"command\": \"ls -la /code/project && python3 --version && which python3\"}",
          "origin": "completion"
        },
        "llm_response_id": "chatcmpl-8d56288e-e49e-4039-b21f-ce1a72f5d3e2",
        "security_risk": "UNKNOWN",
        "summary": "terminal: {\"command\": \"ls -la /code/project && python3 --version && which python3\"}",
        "kind": "ActionEvent"
      }
    }
  },
  {
    "type": "CUSTOM",
    "name": "OPENHANDS_EVENT",
    "value": {
      "eventType": "ObservationEvent",
      "toolCallId": "call_8a49e6d32376415ab02f042d",
      "timestamp": "2026-09-13T05:51:57.327006",
      "data": {
        "id": "6c6e3c92-d59e-49d0-8f3e-c0177087149d",
        "timestamp": "2026-09-13T05:51:57.327006",
        "source": "environment",
        "parent_id": "778106d2-6a43-42a0-a464-ba58b8823844",
        "tool_name": "project_info",
        "tool_call_id": "call_8a49e6d32376415ab02f042d",
        "observation": {
          "content": [
            {
              "cache_prompt": false,
              "type": "text",
              "text": "[Tool 'project_info' executed.]"
            },
            {
              "cache_prompt": false,
              "type": "text",
              "text": "{\"project\":\"PROFESSOR-XMD\",\"environment\":\"computer-use\",\"status\":\"ready\"}"
            }
          ],
          "is_error": false,
          "tool_name": "project_info",
          "kind": "MCPToolObservation"
        },
        "action_id": "8687ceb1-40e2-421b-8b49-917ea3cdcdda",
        "extended_content": [],
        "kind": "ObservationEvent"
      }
    }
  },
  {
    "type": "CUSTOM",
    "name": "OPENHANDS_EVENT",
    "value": {
      "eventType": "ObservationEvent",
      "toolCallId": "call_ee9e0ca8fc1b4ec5b68ca4a6",
      "timestamp": "2026-09-13T05:51:57.861702",
      "data": {
        "id": "9ce6e8de-46b7-405b-9750-3b706b76201d",
        "timestamp": "2026-09-13T05:51:57.861702",
        "source": "environment",
        "parent_id": "6c6e3c92-d59e-49d0-8f3e-c0177087149d",
        "tool_name": "terminal",
        "tool_call_id": "call_ee9e0ca8fc1b4ec5b68ca4a6",
        "observation": {
          "content": [
            {
              "cache_prompt": false,
              "type": "text",
              "text": "\u001b[?2004ltotal 0\ndrwxrwxrwx 2 user user  60 Sep 13 04:08 \u001b[0m\u001b[34;42m.\u001b[0m\ndrwxrwxrwx 6 user user 128 Sep 13 05:43 \u001b[34;42m..\u001b[0m\nPython 3.12.14\n/usr/local/bin/python3\n\u001b[?2004h"
            }
          ],
          "is_error": false,
          "command": "ls -la /code/project && python3 --version && which python3",
          "exit_code": 0,
          "timeout": false,
          "metadata": {
            "exit_code": 0,
            "pid": -1,
            "username": "user",
            "hostname": "e2b",
            "working_dir": "/code/project",
            "py_interpreter_path": "/usr/local/bin/python",
            "prefix": "",
            "suffix": "\n[The command completed with exit code 0.]"
          },
          "kind": "TerminalObservation"
        },
        "action_id": "778106d2-6a43-42a0-a464-ba58b8823844",
        "extended_content": [],
        "kind": "ObservationEvent"
      }
    }
  },
  {
    "type": "CUSTOM",
    "name": "OPENHANDS_EVENT",
    "value": {
      "eventType": "ActionEvent",
      "toolCallId": "call_d5781c7d43844c90a4443fc3",
      "timestamp": "2026-09-13T05:51:57.896292",
      "data": {
        "id": "b9b0cc6b-6490-4f01-bc20-494448b7e6e6",
        "timestamp": "2026-09-13T05:51:57.896292",
        "source": "agent",
        "parent_id": "b666886d-e29e-430b-8949-5a1470a4d19f",
        "thought": [
          {
            "cache_prompt": false,
            "type": "text",
            "text": "\n\nSearch infrastructure is uniformly blocked. Let me make a few targeted attempts at design galleries before deciding.\n\n"
          }
        ],
        "reasoning_content": "The search engines are all blocked or returning errors, so I'm considering whether to build the login form based on established design patterns I'm familiar with, or try accessing a design gallery like Figma Community or Dribbble to gather inspiration for the task.\n",
        "thinking_blocks": [],
        "action": {
          "command": "cd /tmp && UA=\"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36\"; for u in \"https://uiverse.io/homelab-128202/login\" \"https://api.github.com/search/repositories?q=login+form+glassmorphism+in:name,description&sort=stars&per_page=5\" \"https://github.com/topics/glassmorphism\" \"https://raw.githubusercontent.com/tailwindlabs/tailwindcss.com/master/src/pages/components/forms.mdx\"; do printf \"%-72s \" \"$u\"; curl -s -o /dev/null -m 12 -w \"%{http_code} %{size_download}b\\n\" -A \"$UA\" \"$u\"; done",
          "is_input": false,
          "reset": false,
          "kind": "TerminalAction"
        },
        "tool_name": "terminal",
        "tool_call_id": "call_d5781c7d43844c90a4443fc3",
        "tool_call": {
          "id": "call_d5781c7d43844c90a4443fc3",
          "name": "terminal",
          "arguments": "{\"command\": \"cd /tmp && UA=\\\"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36\\\"; for u in \\\"https://uiverse.io/homelab-128202/login\\\" \\\"https://api.github.com/search/repositories?q=login+form+glassmorphism+in:name,description&sort=stars&per_page=5\\\" \\\"https://github.com/topics/glassmorphism\\\" \\\"https://raw.githubusercontent.com/tailwindlabs/tailwindcss.com/master/src/pages/components/forms.mdx\\\"; do printf \\\"%-72s \\\" \\\"$u\\\"; curl -s -o /dev/null -m 12 -w \\\"%{http_code} %{size_download}b\\\\n\\\" -A \\\"$UA\\\" \\\"$u\\\"; done\", \"summary\": \"Probe uiverse, GitHub API, and topic pages\"}",
          "origin": "completion"
        },
        "llm_response_id": "chatcmpl-c327b90e-9bea-44c3-89c4-42a0e169324b",
        "security_risk": "UNKNOWN",
        "summary": "Probe uiverse, GitHub API, and topic pages",
        "kind": "ActionEvent"
      }
    }
  },
  {
    "type": "CUSTOM",
    "name": "OPENHANDS_EVENT",
    "value": {
      "eventType": "ActionEvent",
      "toolCallId": "call_8d488dfd8bcc4bb581b8d47c",
      "timestamp": "2026-09-13T05:52:00.938362",
      "data": {
        "id": "f596b81f-4eb7-4b9f-9553-53ade4d945fd",
        "timestamp": "2026-09-13T05:52:00.938362",
        "source": "agent",
        "parent_id": "9ce6e8de-46b7-405b-9750-3b706b76201d",
        "thought": [
          {
            "cache_prompt": false,
            "type": "text",
            "text": "\n\n"
          }
        ],
        "reasoning_content": "Let's research modern login page designs from 2026. Let me try browser search.\n",
        "thinking_blocks": [],
        "action": {
          "command": "cd /code/project && curl -s -m 20 \"https://duckduckgo.com/html/?q=modern+login+page+design+2026+trends\" | head -c 3000; echo \"EXIT:$?\"",
          "is_input": false,
          "reset": false,
          "kind": "TerminalAction"
        },
        "tool_name": "terminal",
        "tool_call_id": "call_8d488dfd8bcc4bb581b8d47c",
        "tool_call": {
          "id": "call_8d488dfd8bcc4bb581b8d47c",
          "name": "terminal",
          "arguments": "{\"command\": \"cd /code/project && curl -s -m 20 \\\"https://duckduckgo.com/html/?q=modern+login+page+design+2026+trends\\\" | head -c 3000; echo \\\"EXIT:$?\\\"\"}",
          "origin": "completion"
        },
        "llm_response_id": "chatcmpl-fbb176cd-e6db-4300-a090-feb97f8acf86",
        "security_risk": "UNKNOWN",
        "summary": "terminal: {\"command\": \"cd /code/project && curl -s -m 20 \\\"https://duckduckgo.com/html/?q=modern+login+page+design+2026+trends\\\" | head -c 3000; echo \\\"EXIT:$?\\\"\"}",
        "kind": "ActionEvent"
      }
    }
  },
  {
    "type": "CUSTOM",
    "name": "OPENHANDS_EVENT",
    "value": {
      "eventType": "ActionEvent",
      "toolCallId": "call_275a0136137941bebf1a7a81",
      "timestamp": "2026-09-13T05:52:08.171494",
      "data": {
        "id": "6e29a814-3d6a-4573-a61d-540082ec58b6",
        "timestamp": "2026-09-13T05:52:08.171494",
        "source": "agent",
        "parent_id": "7c01ce77-f1f1-4365-b5fc-d5679c4b70dc",
        "thought": [
          {
            "cache_prompt": false,
            "type": "text",
            "text": "\n\n"
          }
        ],
        "reasoning_content": "I'm trying to verify the design trends by checking a few reliable sources using command-line tools, then moving to a browser if that doesn't give me what I need.\n",
        "thinking_blocks": [],
        "action": {
          "command": "cd /tmp && for u in \"https://codrops.com/\" \"https://uxdesign.cc/\" \"https://webdesign.tutsplus.com/\" \"https://brutist.com/\" \"https://www.framer.com/templates/\"; do echo \"=== $u ===\"; curl -s -L -m 25 -A \"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36\" \"$u\" | python3 -c \"\nimport sys,re\nh=sys.stdin.read()\nh=re.sub(r'<script.*?</script>','',h,flags=re.S)\nh=re.sub(r'<style.*?</style>','',h,flags=re.S)\nt=re.sub(r'<[^>]+>',' ',h)\nt=re.sub(r'\\s+',' ',t)\nprint(t[:1200])\nprint('LEN',len(h))\n\"; done",
          "is_input": false,
          "reset": false,
          "kind": "TerminalAction"
        },
        "tool_name": "terminal",
        "tool_call_id": "call_275a0136137941bebf1a7a81",
        "tool_call": {
          "id": "call_275a0136137941bebf1a7a81",
          "name": "terminal",
          "arguments": "{\"command\": \"cd /tmp && for u in \\\"https://codrops.com/\\\" \\\"https://uxdesign.cc/\\\" \\\"https://webdesign.tutsplus.com/\\\" \\\"https://brutist.com/\\\" \\\"https://www.framer.com/templates/\\\"; do echo \\\"=== $u ===\\\"; curl -s -L -m 25 -A \\\"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36\\\" \\\"$u\\\" | python3 -c \\\"\\nimport sys,re\\nh=sys.stdin.read()\\nh=re.sub(r'<script.*?</script>','',h,flags=re.S)\\nh=re.sub(r'<style.*?</style>','',h,flags=re.S)\\nt=re.sub(r'<[^>]+>',' ',h)\\nt=re.sub(r'\\\\s+',' ',t)\\nprint(t[:1200])\\nprint('LEN',len(h))\\n\\\"; done\"}",
          "origin": "completion"
        },
        "llm_response_id": "chatcmpl-6ab90f94-d223-4832-96c4-0788d3e2a2a5",
        "security_risk": "UNKNOWN",
        "summary": "terminal: {\"command\": \"cd /tmp && for u in \\\"https://codrops.com/\\\" \\\"https://uxdesign.cc/\\\" \\\"https://webdesign.tutsplus.com/\\\" \\\"https://brutist.com/\\\" \\\"https://www.framer.com/templates/\\\"; do echo \\\"=== $u ===\\\"; curl -s -L -m 25 -A \\\"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36\\\" \\\"$u\\\" | python3 -c \\\"\\nimport sys,re\\nh=sys.stdin.read()\\nh=re.sub(r'<script.*?</script>','',h,flags=re.S)\\nh=re.sub(r'<style.*?</style>','',h,flags=re.S)\\nt=re.sub(r'<[^>]+>',' ',h)\\nt=re.sub(r'\\\\s+',' ',t)\\nprint(t[:1200])\\nprint('LEN',len(h))\\n\\\"; done\"}",
        "kind": "ActionEvent"
      }
    }
  },
  {
    "type": "CUSTOM",
    "name": "OPENHANDS_EVENT",
    "value": {
      "eventType": "ObservationEvent",
      "toolCallId": "call_810f4638a74d4992a050b9d7",
      "timestamp": "2026-09-13T05:52:20.744091",
      "data": {
        "id": "6cc17ab6-7f4d-4e19-8cd2-e66cc8210f9a",
        "timestamp": "2026-09-13T05:52:20.744091",
        "source": "environment",
        "parent_id": "aadf6781-678f-4254-b041-813a9d538a46",
        "tool_name": "terminal",
        "tool_call_id": "call_810f4638a74d4992a050b9d7",
        "observation": {
          "content": [
            {
              "cache_prompt": false,
              "type": "text",
              "text": "\u001b[?2004l=== brunasilvaraujo/Login-Form ===\n   file README.md\n   dir img\n   file index.html\n   file style.css\n   file workspace.code-workspace\n=== hicodersofficial/glassmorphism-login-form ===\n   file README.md\n   file UI - Glassmorphism login form.xd\n   dir assets\n   file index.html\n   file main.js\n   file style.css\n=== NhanPhamThanh-IT/Autumn-Auth-Pages ===\n   dir JavaScript\n   file LICENSE\n   file README.md\n   dir TypeScript\n\u001b[?2004h"
            }
          ],
          "is_error": false,
          "command": "cd /tmp && UA=\"Mozilla/5.0\"; for r in brunasilvaraujo/Login-Form hicodersofficial/glassmorphism-login-form NhanPhamThanh-IT/Autumn-Auth-Pages; do echo \"=== $r ===\"; curl -s -m 15 -A \"$UA\" \"https://api.github.com/repos/$r/contents\" | python3 -c \"import json,sys; d=json.load(sys.stdin); [print('  ',x['type'],x['name']) for x in d]\" 2>/dev/null; done",
          "exit_code": 0,
          "timeout": false,
          "metadata": {
            "exit_code": 0,
            "pid": -1,
            "username": "user",
            "hostname": "e2b",
            "working_dir": "/tmp",
            "py_interpreter_path": "/usr/local/bin/python",
            "prefix": "",
            "suffix": "\n[The command completed with exit code 0.]"
          },
          "kind": "TerminalObservation"
        },
        "action_id": "aadf6781-678f-4254-b041-813a9d538a46",
        "extended_content": [],
        "kind": "ObservationEvent"
      }
    }
  },
  {
    "type": "CUSTOM",
    "name": "OPENHANDS_EVENT",
    "value": {
      "eventType": "ActionEvent",
      "toolCallId": "call_demo_timeout_001",
      "timestamp": "2026-09-13T05:52:21.500000",
      "data": {
        "id": "demo-timeout-action",
        "timestamp": "2026-09-13T05:52:21.500000",
        "source": "agent",
        "thought": [
          {
            "type": "text",
            "text": "Let me build the project to make sure it compiles cleanly."
          }
        ],
        "reasoning_content": "I should verify the production build succeeds before wrapping up, since a broken build would undermine the whole task.",
        "action": {
          "command": "npm run build",
          "kind": "TerminalAction"
        },
        "tool_name": "terminal",
        "tool_call_id": "call_demo_timeout_001",
        "kind": "ActionEvent"
      }
    }
  },
  {
    "type": "CUSTOM",
    "name": "OPENHANDS_EVENT",
    "value": {
      "eventType": "ObservationEvent",
      "toolCallId": "call_demo_timeout_001",
      "timestamp": "2026-09-13T05:52:22.000000",
      "data": {
        "id": "demo-timeout-obs",
        "timestamp": "2026-09-13T05:52:22.000000",
        "source": "environment",
        "tool_name": "terminal",
        "tool_call_id": "call_demo_timeout_001",
        "observation": {
          "content": [
            {
              "type": "text",
              "text": "npm run build\n...\n[still compiling after 120s]"
            }
          ],
          "is_error": false,
          "command": "npm run build",
          "exit_code": null,
          "timeout": true,
          "kind": "TerminalObservation"
        },
        "kind": "ObservationEvent"
      }
    }
  },
  {
    "type": "CUSTOM",
    "name": "OPENHANDS_EVENT",
    "value": {
      "eventType": "ObservationEvent",
      "toolCallId": "call_demo_mcp_orphan",
      "timestamp": "2026-09-13T05:52:23.000000",
      "data": {
        "id": "demo-mcp-obs",
        "timestamp": "2026-09-13T05:52:23.000000",
        "source": "environment",
        "tool_name": "project_info",
        "tool_call_id": "call_demo_mcp_orphan",
        "observation": {
          "content": [
            {
              "type": "text",
              "text": "{\"project\":\"PROFESSOR-XMD\",\"environment\":\"computer-use\",\"status\":\"ready\"}"
            }
          ],
          "is_error": false,
          "tool_name": "project_info",
          "kind": "MCPToolObservation"
        },
        "kind": "ObservationEvent"
      }
    }
  },
  {
    "type": "CUSTOM",
    "name": "OPENHANDS_EVENT",
    "value": {
      "eventType": "ActionEvent",
      "toolCallId": "call_demo_finish_001",
      "timestamp": "2026-09-13T05:52:25.000000",
      "data": {
        "id": "demo-finish-action",
        "timestamp": "2026-09-13T05:52:25.000000",
        "source": "agent",
        "thought": [
          {
            "type": "text",
            "text": "The login page is live, screenshots look right, and the build passes. I'm done."
          }
        ],
        "reasoning_content": "I've built the login page, served it locally, verified it visually with a screenshot, and confirmed the production build is clean, so all steps of the task are complete.",
        "action": {
          "message": "Built a glassmorphism login page at /code/project/login-app/index.html based on 2026 design research (soft gradients, blurred glass card, minimal single-accent form). Served it on port 8080, opened it in the browser, scrolled through it, and took screenshots to confirm layout and spacing. The design looks modern and matches current trends. Verified `npm run build` completes cleanly.",
          "kind": "FinishAction"
        },
        "tool_name": "finish",
        "tool_call_id": "call_demo_finish_001",
        "kind": "ActionEvent"
      }
    }
  },
  {
    "type": "CUSTOM",
    "name": "OPENHANDS_EVENT",
    "value": {
      "eventType": "ObservationEvent",
      "toolCallId": "call_demo_finish_001",
      "timestamp": "2026-09-13T05:52:25.500000",
      "data": {
        "id": "demo-finish-obs",
        "timestamp": "2026-09-13T05:52:25.500000",
        "source": "environment",
        "tool_name": "finish",
        "tool_call_id": "call_demo_finish_001",
        "observation": {
          "content": [],
          "is_error": false,
          "kind": "FinishObservation"
        },
        "kind": "ObservationEvent"
      }
    }
  },
  {
    "type": "RUN_FINISHED",
    "threadId": "demo",
    "runId": "demo"
  }
];
