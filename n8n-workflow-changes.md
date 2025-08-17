# n8n Workflow Changes Required

This document outlines the changes needed in the n8n workflow to ensure proper integration with the Next.js chat application.

## 1. Expression References

In all n8n workflow nodes, ensure that you use the correct expression references:

- Always reference the message as `{{$json.chatInput}}` (not `message`)
- Always reference the session as `{{$json.chatId}}` (not `sessionId`)

## 2. Guard Against Empty chatInput

If any node tries to use `.replace()` or other string operations on `chatInput`, guard it with:

```
{{ ($json.chatInput || '') }}
```

This ensures that if `chatInput` is null or undefined, it defaults to an empty string.

## 3. Set Node for Question Mapping

If a node expects `question` or `input`, add a Set node right after the Chat Trigger to map:

```
question = {{$json.chatInput}}
```

## 4. Respond to Chat Node

Ensure that the "Respond to Chat" node is the final node in the workflow so that the webhook returns properly.

## 5. External Service Failures

If an external service (LLM, Supabase, Google Drive, etc.) fails:

1. Set "Continue On Fail" temporarily to debug the issue
2. Once identified, fix the credentials or keys
3. Remove "Continue On Fail" after fixing the issue

## Example Set Node Configuration

Add a Set node immediately after the Chat Trigger node with the following configuration:

- Field to set: `question`
- Value: `{{$json.chatInput}}`

This ensures that subsequent nodes can reference `{{$json.question}}` if needed.

## Example Guard Usage

When using string operations, always guard against empty values:

```
{{ ($json.chatInput || '').replace(/\n/g, ' ') }}
```

This prevents errors when `chatInput` is null or undefined.