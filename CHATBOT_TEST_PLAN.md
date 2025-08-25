# Chatbot Test Plan

## Overview

This document outlines comprehensive testing procedures for the enhanced chatbot system, covering success scenarios, error conditions, and edge cases.

## Test Environment Setup

### Prerequisites
1. Next.js development environment
2. Access to n8n webhook endpoint
3. Browser with developer tools
4. Network simulation tools (optional)

### Configuration Files
- `.env.local` - Environment variables
- `test-chatbot-enhanced.html` - Standalone test interface
- Browser developer tools for network simulation

## Test Categories

### 1. Success Path Testing

#### Test 1.1: Basic Message Exchange
**Objective**: Verify normal chatbot functionality
**Steps**:
1. Open chat interface
2. Send message: "hi"
3. Wait for response
**Expected Result**: 
- Typing indicator appears
- Real assistant response received within 30 seconds
- No error messages displayed
- Service status shows "Online • Ready to help"

#### Test 1.2: Multiple Message Conversation
**Objective**: Verify session continuity
**Steps**:
1. Send message: "What programs do you offer?"
2. Wait for response
3. Send follow-up: "Tell me more about the first one"
4. Wait for response
**Expected Result**:
- Both messages receive contextual responses
- Session ID remains consistent
- No errors or timeouts

#### Test 1.3: Long Message Handling
**Objective**: Test message length limits
**Steps**:
1. Type a message close to 1000 characters
2. Verify character counter updates
3. Send the message
**Expected Result**:
- Character counter shows correct count
- Message sends successfully
- Response received normally

### 2. Error Handling Testing

#### Test 2.1: Network Disconnection
**Objective**: Test offline error handling
**Steps**:
1. Disconnect internet connection
2. Send a message
3. Observe error handling
4. Reconnect internet
5. Click "Retry Connection" button
**Expected Result**:
- Service offline banner appears immediately
- Error message: "Unable to connect to the chat service"
- Retry connection button works
- Service comes back online after reconnection

#### Test 2.2: Service Unavailable (5xx Errors)
**Objective**: Test server error handling
**Steps**:
1. Configure invalid webhook URL in `.env.local`
2. Restart application
3. Send a message
**Expected Result**:
- Service offline banner appears
- Error message: "The chat service is temporarily unavailable"
- Retry button available
- Error code displayed in message bubble

#### Test 2.3: Timeout Handling
**Objective**: Test request timeout behavior
**Steps**:
1. Set very low timeout: `NEXT_PUBLIC_CHAT_TIMEOUT=1000`
2. Send a message
3. Observe timeout behavior
**Expected Result**:
- Request times out after 1 second
- Error message: "Request timed out. The service may be experiencing high load"
- Retry button appears
- Exponential backoff applied on retries

#### Test 2.4: Rate Limiting
**Objective**: Test rate limit handling
**Steps**:
1. Send 15+ messages rapidly (exceeds rate limit)
2. Observe rate limit response
3. Wait for rate limit reset
4. Try sending again
**Expected Result**:
- Rate limit error after threshold exceeded
- Error message: "Too many requests. Please wait a moment"
- Retry works after waiting period
- Rate limit headers respected

#### Test 2.5: Malformed Response Handling
**Objective**: Test invalid response parsing
**Steps**:
1. Configure webhook to return invalid JSON
2. Send a message
3. Observe error handling
**Expected Result**:
- Graceful error handling
- Fallback message displayed
- Error code provided for debugging
- Retry option available

### 3. Health Check Testing

#### Test 3.1: Initial Health Check
**Objective**: Verify startup health check
**Steps**:
1. Open chat interface
2. Observe initial status
3. Check network tab for health check request
**Expected Result**:
- "Checking service status..." appears briefly
- GET request to `/api/chat` in network tab
- Status updates to "Online • Ready to help"
- No error banners if service is healthy

#### Test 3.2: Health Check Caching
**Objective**: Verify health check caching behavior
**Steps**:
1. Open chat interface
2. Wait for initial health check
3. Refresh page within 30 seconds
4. Check network tab
**Expected Result**:
- Initial health check on first load
- Cached result used on refresh (no new request)
- Cache expires after 30 seconds

#### Test 3.3: Health Check Failure Recovery
**Objective**: Test recovery from health check failure
**Steps**:
1. Start with service offline
2. Observe offline status
3. Bring service online
4. Click "Retry Connection"
**Expected Result**:
- Initial offline status detected
- Retry connection button works
- Status updates to online after service recovery
- Subsequent messages work normally

### 4. Retry Logic Testing

#### Test 4.1: Exponential Backoff
**Objective**: Verify retry timing
**Steps**:
1. Configure service to return 500 errors
2. Send a message
3. Monitor retry attempts in console
4. Measure retry intervals
**Expected Result**:
- First retry after ~1 second
- Second retry after ~2 seconds  
- Third retry after ~4 seconds
- Maximum 3 retries attempted
- Exponential backoff pattern followed

#### Test 4.2: Non-Retryable Errors
**Objective**: Test immediate failure for non-retryable errors
**Steps**:
1. Send message with invalid format (trigger 400 error)
2. Observe retry behavior
**Expected Result**:
- No retry attempts made
- Immediate error message
- Error categorized as non-retryable
- No retry button shown

#### Test 4.3: Retry Button Functionality
**Objective**: Test manual retry capability
**Steps**:
1. Send message that fails
2. Click retry button
3. Observe retry attempt
**Expected Result**:
- Retry button appears after retryable error
- Clicking retry resends last message
- New attempt uses fresh request
- Button disabled during retry

### 5. Race Condition Testing

#### Test 5.1: Rapid Message Sending
**Objective**: Test concurrent request handling
**Steps**:
1. Send first message
2. Immediately send second message before first completes
3. Observe behavior
**Expected Result**:
- First request cancelled
- Only second request processed
- No duplicate responses
- Clean UI state maintained

#### Test 5.2: Request Cancellation
**Objective**: Test request cancellation on new message
**Steps**:
1. Send message with slow response
2. Send another message immediately
3. Check network tab
**Expected Result**:
- First request shows as cancelled
- Second request completes normally
- No race condition artifacts
- Proper response handling

### 6. UI/UX Testing

#### Test 6.1: Typing Indicator
**Objective**: Test typing indicator behavior
**Steps**:
1. Send a message
2. Observe typing indicator
3. Wait for response
**Expected Result**:
- Typing indicator appears immediately after sending
- Indicator shows animated dots
- Indicator disappears when response arrives
- Smooth visual transitions

#### Test 6.2: Service Status Banner
**Objective**: Test status banner visibility and behavior
**Steps**:
1. Start with service online (no banner)
2. Simulate service offline
3. Observe banner appearance
4. Restore service
5. Observe banner disappearance
**Expected Result**:
- No banner when service is online
- Red banner appears when offline
- Banner includes retry button
- Banner disappears when service restored

#### Test 6.3: Error Message Display
**Objective**: Test error message presentation
**Steps**:
1. Trigger various error types
2. Observe error message styling
3. Check error code display
**Expected Result**:
- Error messages have distinct styling (red background)
- Error codes displayed in monospace font
- Messages are user-friendly
- Technical details available for debugging

### 7. Configuration Testing

#### Test 7.1: Environment Variable Changes
**Objective**: Test configuration flexibility
**Steps**:
1. Change `NEXT_PUBLIC_CHAT_TIMEOUT` to 5000
2. Restart application
3. Send message and verify timeout
4. Change `NEXT_PUBLIC_CHAT_MAX_RETRIES` to 1
5. Test retry behavior
**Expected Result**:
- Timeout applies after 5 seconds
- Only 1 retry attempt made
- Configuration changes take effect
- No code changes required

#### Test 7.2: Endpoint Configuration
**Objective**: Test API endpoint flexibility
**Steps**:
1. Change `NEXT_PUBLIC_CHAT_API_ENDPOINT` to `/api/v2/chat`
2. Restart application
3. Send message
4. Check network tab for endpoint
**Expected Result**:
- Requests go to new endpoint
- Health checks use new endpoint
- Configuration applied correctly
- Error handling still works

### 8. Performance Testing

#### Test 8.1: Response Time Measurement
**Objective**: Measure typical response times
**Steps**:
1. Send 10 messages with simple queries
2. Measure response times
3. Calculate average
**Expected Result**:
- Average response time under 5 seconds
- No significant degradation over time
- Consistent performance
- Acceptable user experience

#### Test 8.2: Memory Usage
**Objective**: Check for memory leaks
**Steps**:
1. Send 50+ messages
2. Monitor browser memory usage
3. Reset chat and observe memory cleanup
**Expected Result**:
- Memory usage remains stable
- No significant memory leaks
- Chat reset cleans up properly
- Performance maintained over time

### 9. Accessibility Testing

#### Test 9.1: Keyboard Navigation
**Objective**: Test keyboard accessibility
**Steps**:
1. Navigate using only keyboard
2. Test Tab, Enter, Escape keys
3. Verify focus management
**Expected Result**:
- All interactive elements accessible via keyboard
- Enter key sends messages
- Focus management works properly
- Screen reader compatibility

#### Test 9.2: Screen Reader Compatibility
**Objective**: Test with screen readers
**Steps**:
1. Enable screen reader
2. Navigate chat interface
3. Send messages and receive responses
**Expected Result**:
- All content announced properly
- Status changes communicated
- Error messages read aloud
- Proper ARIA labels used

## Test Execution Checklist

### Pre-Test Setup
- [ ] Environment variables configured
- [ ] Development server running
- [ ] Browser developer tools open
- [ ] Network conditions noted

### Success Path Tests
- [ ] Test 1.1: Basic Message Exchange
- [ ] Test 1.2: Multiple Message Conversation  
- [ ] Test 1.3: Long Message Handling

### Error Handling Tests
- [ ] Test 2.1: Network Disconnection
- [ ] Test 2.2: Service Unavailable
- [ ] Test 2.3: Timeout Handling
- [ ] Test 2.4: Rate Limiting
- [ ] Test 2.5: Malformed Response Handling

### Health Check Tests
- [ ] Test 3.1: Initial Health Check
- [ ] Test 3.2: Health Check Caching
- [ ] Test 3.3: Health Check Failure Recovery

### Retry Logic Tests
- [ ] Test 4.1: Exponential Backoff
- [ ] Test 4.2: Non-Retryable Errors
- [ ] Test 4.3: Retry Button Functionality

### Race Condition Tests
- [ ] Test 5.1: Rapid Message Sending
- [ ] Test 5.2: Request Cancellation

### UI/UX Tests
- [ ] Test 6.1: Typing Indicator
- [ ] Test 6.2: Service Status Banner
- [ ] Test 6.3: Error Message Display

### Configuration Tests
- [ ] Test 7.1: Environment Variable Changes
- [ ] Test 7.2: Endpoint Configuration

### Performance Tests
- [ ] Test 8.1: Response Time Measurement
- [ ] Test 8.2: Memory Usage

### Accessibility Tests
- [ ] Test 9.1: Keyboard Navigation
- [ ] Test 9.2: Screen Reader Compatibility

## Test Results Documentation

### Test Result Template
```
Test: [Test Name]
Date: [Date]
Tester: [Name]
Result: [PASS/FAIL]
Notes: [Observations]
Issues: [Any problems found]
```

### Common Issues and Solutions

#### Issue: Health Check Fails
**Symptoms**: Constant offline status
**Diagnosis**: Check API endpoint accessibility
**Solution**: Verify endpoint URL and CORS configuration

#### Issue: Retries Not Working
**Symptoms**: No retry attempts made
**Diagnosis**: Error categorized as non-retryable
**Solution**: Check error categorization logic

#### Issue: Timeout Too Short/Long
**Symptoms**: Premature timeouts or hanging requests
**Diagnosis**: Timeout configuration issue
**Solution**: Adjust `NEXT_PUBLIC_CHAT_TIMEOUT` value

#### Issue: Rate Limiting Too Aggressive
**Symptoms**: Frequent rate limit errors
**Diagnosis**: Rate limit configuration too low
**Solution**: Adjust backend rate limit settings

## Automated Testing Considerations

### Unit Tests
- Configuration loading
- Error categorization
- Retry logic
- Health check caching

### Integration Tests
- API endpoint communication
- Error response handling
- Timeout behavior
- Retry mechanisms

### End-to-End Tests
- Complete user workflows
- Error recovery scenarios
- Cross-browser compatibility
- Performance benchmarks

## Conclusion

This test plan ensures comprehensive coverage of the enhanced chatbot functionality, including:
- Normal operation verification
- Error handling validation
- Performance characteristics
- User experience quality
- Configuration flexibility
- Accessibility compliance

Regular execution of these tests will maintain system reliability and user satisfaction.