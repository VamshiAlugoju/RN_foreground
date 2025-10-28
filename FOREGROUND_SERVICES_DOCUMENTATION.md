# Foreground Services Implementation Documentation

## Overview
This document describes the implementation of two foreground services for a React Native calling application:
1. **Call Foreground Service** - Handles ongoing calls with native notification controls
2. **Location Sharing Foreground Service** - Manages background location sharing

## Architecture

### Native Android Implementation

#### Call Service (`android/app/src/main/java/com/foreground_task/callservice/`)

**Files:**
- `CallForegroundService.kt` - Main service implementation
- `CallServiceModule.kt` - React Native bridge module
- `CallServicePackage.kt` - Package registration

**Key Features:**
- **Dual Notification Channels**: Separate channels for incoming calls (HIGH priority) and ongoing calls (DEFAULT priority)
- **Android 12+ CallStyle Support**: Uses native `CallStyle.forIncomingCall()` and `CallStyle.forOngoingCall()` for better UX
- **Action Button Support**: Accept/Reject for incoming calls, End Call for ongoing calls
- **Fallback Socket Communication**: When React Native is dead, uses temporary socket connections to emit call events
- **Wake Lock & WiFi Lock**: Prevents device sleep and maintains network connection
- **Context Persistence**: Stores call metadata in SharedPreferences for recovery

**Notification Types:**
- `incoming` - High priority with Accept/Reject buttons
- `outgoing` - Shows "Calling..." with Cancel button  
- `ongoing` - Shows call duration with End Call button

#### Location Sharing Service (`android/app/src/main/java/com/foreground_task/locationsharing/`)

**Files:**
- `LocationSharingService.kt` - Main service implementation
- `LocationSharingModule.kt` - React Native bridge module
- `LocationSharingPackage.kt` - Package registration

**Key Features:**
- **Background Location Sharing**: Sends mock coordinates every 2 seconds via Socket.IO
- **Persistent Notification**: Low priority, non-dismissable notification with "Stop sharing" action
- **Session Persistence**: Saves socket connection data to survive app kills
- **Notification Monitoring**: Timer-based checker that re-posts notification if removed
- **Socket Authentication**: Handles authentication flow before starting location sharing

### React Native Integration

#### Call Provider (`src/context/CallProvider.tsx`)

**Integration Points:**
- **Service Lifecycle Management**: Starts/stops foreground service based on call state
- **Context Persistence**: Saves call state to AsyncStorage and native SharedPreferences
- **Event Bridge**: Listens for native notification actions via `NativeEventEmitter`
- **State Recovery**: Restores call state on app restart, checks for native-ended calls
- **Socket Reconnection**: Handles socket reconnection when app resumes with active calls

**Key Methods:**
```typescript
// Service control
CallService?.startForegroundService?.(callType, username)
CallService?.stopForegroundService?.()

// Context persistence
CallService?.updateCallContext?.({
  accessToken, socketUrl, userId, callId, roomId, 
  clientCallId, initiatorId, callType, state
})

// Native event handling
const callEventEmitter = new NativeEventEmitter(CallService)
callEventEmitter.addListener('CALL_ACCEPTED_FROM_NOTIFICATION', answerCall)
callEventEmitter.addListener('CALL_REJECTED_FROM_NOTIFICATION', rejectCall)
callEventEmitter.addListener('CALL_ENDED_FROM_NOTIFICATION', endCall)
```

#### Location Provider (`src/context/LocationProvider.tsx`)

**Integration Points:**
- **Service Control**: Starts/stops location sharing service with session data
- **State Persistence**: Saves sharing state to AsyncStorage
- **Native Event Handling**: Listens for service stop events from notification actions
- **Service Status Checking**: Verifies if native service is actually running

**Key Methods:**
```typescript
// Service control with session data
foregroundService.start('Location sharing active', 'Tap to return to app', {
  socketUrl, authToken, userId, recieverId, username, intervalMs: 2000
})

// Event handling
const eventEmitter = foregroundService.getEventEmitter()
eventEmitter.addListener('LocationSharingServiceStopped', () => {
  setIsSharing(false)
  setRecipentInfo(null)
})
```

#### Foreground Service Bridge (`src/services/foreground/ForegroundService.ts`)

**Purpose:**
- Provides unified interface for both services
- Handles native module availability checks
- Manages event emitters for native-to-JS communication
- Type-safe wrapper around native modules

## Key Implementation Details

### 1. Service Persistence Strategy

**Call Service:**
- Uses `START_STICKY` to restart after system kills
- Stores call context in SharedPreferences
- Implements "ghost call" prevention by tracking native-ended calls
- React Native checks `getLastNativeEndedCallId()` on startup

**Location Service:**
- Uses `onTaskRemoved()` to restart service with saved session data
- Saves socket connection parameters to SharedPreferences
- Implements notification monitoring to ensure visibility

### 2. Notification Management

**Call Notifications:**
- Android 12+: Uses `CallStyle` for native call UI
- Pre-Android 12: Uses action buttons with custom icons
- Dual channels for different priority levels
- Supports both legacy and new parameter formats

**Location Notifications:**
- Low priority to prevent pop-ups
- Non-dismissable with "Stop sharing" action
- Timer-based monitoring to re-post if removed
- Silent (no sound/vibration) but visible on lock screen
- Local-only (not shown on external devices like smartwatches)

### 3. Socket Communication

**Call Service Fallback:**
- Creates temporary socket connections for one-time events
- Prevents interference with React Native socket
- Emits events like `calls:end`, `REJECT_CALL`, `calls:answer`
- Closes connection immediately after emitting

**Location Service:**
- Maintains persistent socket connection
- Handles authentication flow
- Sends location data every 2 seconds
- Reconnects automatically on disconnection

### 4. Permission Handling

**Required Permissions:**
- `FOREGROUND_SERVICE_PHONE_CALL` (Android 14+)
- `RECORD_AUDIO` (microphone for calls)
- `CAMERA` (for video calls)
- `POST_NOTIFICATIONS` (Android 13+)

**Permission Flow:**
- Proactively requests essential permissions on app start
- Checks permissions before starting services
- Shows appropriate error messages for denied permissions

## Usage Examples

### Starting a Call
```typescript
// In CallProvider
const startCall = async (params: StartCallParams) => {
  // Start foreground service
  CallService?.startForegroundService?.('outgoing', recipientName)
  
  // Save call state
  await AsyncStorage.setItem('ongoingCall', JSON.stringify({
    state: 'outgoing',
    clientCallId, callType, recipients, timestamp: Date.now()
  }))
  
  // Update native context
  CallService?.updateCallContext?.({
    accessToken: user.accessToken,
    socketUrl, userId, callId, roomId, callType, state: 'outgoing'
  })
}
```

### Starting Location Sharing
```typescript
// In LocationProvider
const startLocationSharing = async (recieverId: string, username: string) => {
  // Start native service with session data
  foregroundService.start('Location sharing active', 'Tap to return to app', {
    socketUrl: 'https://test-server.chatbucket.chat/',
    authToken: user.accessToken,
    userId: user.id,
    recieverId,
    username,
    intervalMs: 2000
  })
  
  // Save state
  await saveSharingState(true, recieverId, username)
}
```

## Error Handling & Recovery

### Call Service Recovery
1. **App Kill Detection**: Checks `getLastNativeEndedCallId()` on startup
2. **State Validation**: Verifies call is recent (< 5 minutes)
3. **Socket Reconnection**: Attempts immediate reconnection if user data available
4. **Fallback Communication**: Uses native socket if React Native is dead

### Location Service Recovery
1. **Service Status Check**: Verifies native service is actually running
2. **State Synchronization**: Loads saved state from AsyncStorage
3. **Session Restoration**: Restores socket connection parameters
4. **Notification Monitoring**: Re-posts notification if removed

## Testing Considerations

### Call Service Testing
- Test notification actions (Accept/Reject/End) work when app is backgrounded
- Verify call state persists across app kills
- Test socket fallback when React Native is dead
- Validate "ghost call" prevention works correctly

### Location Service Testing
- Test location sharing continues when app is killed
- Verify notification persists and is non-dismissable
- Test "Stop sharing" action from notification
- Validate session data restoration on service restart

## Performance Considerations

- **Battery Optimization**: Uses appropriate wake lock levels
- **Network Efficiency**: Location service uses efficient socket connections
- **Memory Management**: Temporary sockets are closed immediately after use
- **Notification Optimization**: Low priority notifications to prevent spam

## Security Considerations

- **Token Management**: Access tokens stored securely in SharedPreferences
- **Socket Security**: Uses authenticated socket connections
- **Permission Validation**: Checks permissions before service operations
- **Data Cleanup**: Clears sensitive data when services stop

This implementation provides robust foreground services that maintain functionality even when the React Native app is backgrounded or killed, with proper state persistence and recovery mechanisms.
