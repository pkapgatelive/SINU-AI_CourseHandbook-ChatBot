# Next.js + n8n Chatbot Integration - Changes Summary

This document summarizes all the changes made to correct the payload and workflow mapping for the Next.js + n8n chatbot integration.

## 1. Proxy API Changes (`/api/chat`)

### Payload Translation
The proxy now correctly translates the frontend payload:
```json
{
  "sessionId": "<sessionId>",
  "message": "<message>",
  "metadata": { ... }
}
```

To the n8n Chat Trigger format:
```json
{
  "chatId": "<sessionId>",
  "chatInput": "<message>",
  "action": "sendMessage",
  "source": "web",
  ...metadata
}
```

### Guard Against Empty chatInput
Added a guard to ensure `chatInput` defaults to an empty string if the message is falsy:
```javascript
const n8nBody = {
  chatId: sessionId,
  chatInput: message || '',  // Guard against empty chatInput
  action: "sendMessage",
  source: "web",
  ...(metadata && typeof metadata === 'object' ? metadata : {})
};
```

## 2. Response Handling

The proxy already correctly handles both JSON and streaming responses:
- JSON responses are parsed and returned as clean JSON
- Streaming responses (SSE) are properly forwarded with correct headers
- Error responses are properly formatted and passed through

## 3. n8n Workflow Changes

See `n8n-workflow-changes.md` for detailed instructions on updating the n8n workflow, including:

- Using correct expression references (`{{$json.chatInput}}` and `{{$json.chatId}}`)
- Guarding against empty `chatInput` with `{{ ($json.chatInput || '') }}`
- Adding a Set node to map `question = {{$json.chatInput}}`
- Ensuring "Respond to Chat" is the final node
- Handling external service failures appropriately

## 4. Deliverables Status

✅ Update /api/chat proxy to translate {sessionId, message} → {chatId, chatInput}
✅ Update workflow expressions to use chatInput/chatId
✅ Add a guard against empty chatInput
✅ Ensure response returns clean JSON or streamed text to the client

All requirements have been addressed. The integration should now work correctly with the n8n Chat Trigger.