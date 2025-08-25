#!/bin/bash

# Webhook Testing Script
# This script tests the n8n webhook directly using curl

echo "🔧 Webhook Testing Utility"
echo "=========================="

# Configuration
WEBHOOK_URL="${N8N_WEBHOOK_URL:-https://n8n.srv963093.hstgr.cloud/webhook/5f1c0c82-0ff9-40c7-9e2e-b1a96ffe24cd/chat}"
TEST_MESSAGE="${1:-hi}"
TEST_SESSION_ID="test$(date +%s)$(openssl rand -hex 12 2>/dev/null || echo "abcdef123456789012345678")"

echo "Webhook URL: $WEBHOOK_URL"
echo "Session ID: $TEST_SESSION_ID (length: ${#TEST_SESSION_ID})"
echo "Test Message: \"$TEST_MESSAGE\""
echo ""

# Create test payload
PAYLOAD=$(cat <<EOF
{
  "chatId": "$TEST_SESSION_ID",
  "chatInput": "$TEST_MESSAGE",
  "action": "sendMessage",
  "source": "web",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "userAgent": "webhook-test-script"
}
EOF
)

echo "📤 Sending payload:"
echo "$PAYLOAD"
echo ""

echo "🚀 Making request..."
START_TIME=$(date +%s%3N)

# Make the request with detailed output
RESPONSE=$(curl -s -w "\n---CURL_INFO---\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}\nCONTENT_TYPE:%{content_type}\nSIZE_DOWNLOAD:%{size_download}\n" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "User-Agent: webhook-test-script/1.0" \
  -d "$PAYLOAD" \
  "$WEBHOOK_URL")

END_TIME=$(date +%s%3N)
DURATION=$((END_TIME - START_TIME))

echo "📥 Response received (${DURATION}ms):"
echo ""

# Parse response
BODY=$(echo "$RESPONSE" | sed '/---CURL_INFO---/,$d')
INFO=$(echo "$RESPONSE" | sed -n '/---CURL_INFO---/,$p')

HTTP_CODE=$(echo "$INFO" | grep "HTTP_CODE:" | cut -d: -f2)
TIME_TOTAL=$(echo "$INFO" | grep "TIME_TOTAL:" | cut -d: -f2)
CONTENT_TYPE=$(echo "$INFO" | grep "CONTENT_TYPE:" | cut -d: -f2)
SIZE_DOWNLOAD=$(echo "$INFO" | grep "SIZE_DOWNLOAD:" | cut -d: -f2)

echo "Status: $HTTP_CODE"
echo "Duration: ${TIME_TOTAL}s"
echo "Content-Type: $CONTENT_TYPE"
echo "Size: $SIZE_DOWNLOAD bytes"
echo ""

echo "📄 Response body:"
echo "Raw length: ${#BODY}"

if [ ${#BODY} -gt 0 ]; then
    echo "Raw content:"
    echo "$BODY"
    echo ""
    
    # Try to pretty-print JSON if it looks like JSON
    if echo "$BODY" | grep -q "^[[:space:]]*{" || echo "$BODY" | grep -q "^[[:space:]]*\["; then
        echo "🔍 Attempting to format as JSON:"
        if command -v python3 >/dev/null 2>&1; then
            echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "Failed to parse as JSON"
        elif command -v jq >/dev/null 2>&1; then
            echo "$BODY" | jq . 2>/dev/null || echo "Failed to parse as JSON"
        else
            echo "No JSON formatter available (python3 or jq)"
        fi
        echo ""
    fi
    
    # Check for common response patterns
    echo "🔍 Analysis:"
    if echo "$BODY" | grep -q "reply\|response\|message\|text\|content\|output\|result\|answer"; then
        echo "✅ Contains potential response fields"
    else
        echo "❌ No obvious response fields found"
    fi
    
    if echo "$BODY" | grep -q "null\|{}\|\[\]"; then
        echo "⚠️  Contains null/empty values"
    fi
    
    if echo "$BODY" | grep -q "error\|Error\|ERROR"; then
        echo "❌ Contains error indicators"
    fi
else
    echo "❌ Empty response body"
fi

echo ""
echo "🏁 Test completed"

# Exit with HTTP status code for scripting
if [ "$HTTP_CODE" = "200" ]; then
    exit 0
else
    exit 1
fi