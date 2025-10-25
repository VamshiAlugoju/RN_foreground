package com.foreground_task.callservice

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat
import com.foreground_task.callservice.CallServiceModule
import com.foreground_task.MainActivity
import com.foreground_task.R
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.util.Timer
import java.util.TimerTask

class CallForegroundService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null
  private var wifiLock: WifiManager.WifiLock? = null
  private var heartbeatTimer: Timer? = null
  private var notificationCheckTimer: Timer? = null
  private var currentTitle: String = "Call in progress"
  private var currentMessage: String = DEFAULT_MESSAGE
  private var currentType: String = CALL_TYPE_ONGOING
  
  // Cached call context from SharedPreferences
  // Note: We create temporary sockets on-demand instead of maintaining a persistent connection
  // This prevents interference with the React Native socket connection
  private var socketUrl: String? = null
  private var accessToken: String? = null
  private var userId: String? = null
  private var callId: String? = null
  private var roomId: String? = null
  private var clientCallId: String? = null
  private var initiatorId: String? = null
  private var callType: String? = null
  private var callState: String? = null

  override fun onCreate() {
    super.onCreate()
    Log.d("CallForegroundService", "onCreate called")
    
    // Load saved call context from SharedPreferences
    loadCallContext()
    
    ensureChannel()
    startNotificationChecker()
    // Start immediately with minimal notification to satisfy 5s requirement on some OEMs
    try {
      val notification = buildNotification("Call in progress", DEFAULT_MESSAGE, CALL_TYPE_ONGOING)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
        )
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (_: Throwable) {}
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    Log.d("CallForegroundService", "onStartCommand")
    
    // React Native side should request FOREGROUND_SERVICE_PHONE_CALL permission before starting this service (Android 14+)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val hasPermission = checkSelfPermission(
        Manifest.permission.FOREGROUND_SERVICE_PHONE_CALL
      ) == PackageManager.PERMISSION_GRANTED
      if (!hasPermission) {
        Log.w("CallForegroundService", "Missing FOREGROUND_SERVICE_PHONE_CALL permission; stopping service")
        stopSelf()
        return START_NOT_STICKY
      }
    }
    
    // Handle action button presses first
    val action = intent?.action
    if (!action.isNullOrEmpty()) {
      // Reload call context in case it was cleared
      loadCallContext()
      
      // Check if React Native is alive
      val isRnAlive = CallServiceModule.getInstance()?.isReactNativeAlive() == true
      
      if (isRnAlive) {
        // RN is alive - use standard event emission
        Log.d("CallService", "React Native is alive, using RN bridge for action: $action")
        when (action) {
          ACTION_END_CALL -> {
            Log.d("CallService", "Call ended")
            CallServiceModule.getInstance()?.emitCallEndedEvent()
            stopSelf()
            return START_NOT_STICKY
          }
          ACTION_ACCEPT_CALL -> {
            Log.d("CallService", "Call accepted")
            CallServiceModule.getInstance()?.emitCallAcceptedEvent()
            
            // Bring app to foreground if it's in background
            try {
              val isRnActive = CallServiceModule.getInstance()?.isReactNativeAlive() == true
              if (!isRnActive) {
                // Activity not visible, launch it
                val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                  addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                }
                launchIntent?.let { startActivity(it) }
                Log.d("CallService", "Launched RN activity (was in background)")
              }
            } catch (e: Exception) {
              Log.e("CallService", "Failed to bring activity to foreground: ${e.message}", e)
            }
          }
          ACTION_REJECT_CALL -> {
            Log.d("CallService", "Call rejected")
            CallServiceModule.getInstance()?.emitCallRejectedEvent()
            stopSelf()
            return START_NOT_STICKY
          }
        }
        
        // Reassert the foreground with the latest known state
        try {
          val ongoing = buildNotification(currentTitle, currentMessage, currentType)
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
              NOTIFICATION_ID,
              ongoing,
              ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
            )
          } else {
            startForeground(NOTIFICATION_ID, ongoing)
          }
        } catch (_: Throwable) {}
        
        ensureWakeLock()
        ensureWifiLock()
        startHeartbeat()
        return START_STICKY
      } else {
        // RN is dead - use native socket fallback
        Log.w("CallService", "React Native is DEAD, using native socket fallback for action: $action")
        Log.d("CallService", "Context available: socketUrl=$socketUrl, userId=$userId, callId=$callId, roomId=$roomId")
        
        when (action) {
          ACTION_END_CALL -> {
            emitEvent("calls:end", mapOf(
              "callId" to callId,
              "clientId" to userId,
              "roomId" to roomId
            ))
            return START_NOT_STICKY
          }
          ACTION_REJECT_CALL -> {
            emitEvent("REJECT_CALL", mapOf(
              "callId" to callId,
              "clientId" to userId,
              "roomId" to roomId
            ))
            return START_NOT_STICKY
          }
          ACTION_ACCEPT_CALL -> {
            // Emit socket event
            emitEvent("calls:answer", mapOf(
              "roomId" to roomId
            ))
            
            // Launch React Native activity so user sees the call UI
            try {
              val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
              }
              launchIntent?.let { startActivity(it) }
              Log.d("CallService", "Launched RN activity after accepting call from notification")
            } catch (e: Exception) {
              Log.e("CallService", "Failed to launch activity: ${e.message}", e)
            }
            
            return START_STICKY
          }
        }
      }
    }

    // Read extras - support both new (title, message, type) and legacy (callType, username) parameters
    val titleExtra = intent?.getStringExtra(EXTRA_TITLE)
    val messageExtra = intent?.getStringExtra(EXTRA_MESSAGE)
    val typeExtra = intent?.getStringExtra(EXTRA_TYPE)
    
    // Legacy parameter support
    val callTypeExtra = intent?.getStringExtra(EXTRA_CALL_TYPE)
    val usernameExtra = intent?.getStringExtra(EXTRA_USERNAME)
    
    // Determine call type
    val finalType = when {
      !typeExtra.isNullOrBlank() -> when (typeExtra.lowercase()) {
        CALL_TYPE_OUTGOING -> CALL_TYPE_OUTGOING
        CALL_TYPE_INCOMING -> CALL_TYPE_INCOMING
        else -> CALL_TYPE_ONGOING
      }
      !callTypeExtra.isNullOrBlank() -> when (callTypeExtra.lowercase()) {
        CALL_TYPE_OUTGOING -> CALL_TYPE_OUTGOING
        CALL_TYPE_INCOMING -> CALL_TYPE_INCOMING
        else -> CALL_TYPE_ONGOING
      }
      else -> CALL_TYPE_ONGOING
    }
    
    // Determine title and message
    val finalTitle: String
    val finalMessage: String
    
    if (!titleExtra.isNullOrBlank() && !messageExtra.isNullOrBlank()) {
      // New parameter style
      finalTitle = titleExtra
      finalMessage = messageExtra
    } else {
      // Legacy parameter style - build title/message from username and callType
      val safeUsername = usernameExtra?.ifBlank { "" } ?: ""
      val (generatedTitle, generatedMessage) = when (finalType) {
        CALL_TYPE_OUTGOING -> {
          val t = if (safeUsername.isBlank()) "Calling…" else "Calling ${safeUsername}…"
          t to "Waiting for answer"
        }
        CALL_TYPE_INCOMING -> {
          val t = if (safeUsername.isBlank()) "Incoming call" else "Incoming call from ${safeUsername}"
          t to "Tap to answer or reject"
        }
        else -> {
          val t = if (safeUsername.isBlank()) "Ongoing call" else "Ongoing call with ${safeUsername}"
          t to DEFAULT_MESSAGE
        }
      }
      finalTitle = generatedTitle
      finalMessage = generatedMessage
    }

    currentTitle = finalTitle
    currentMessage = finalMessage
    currentType = finalType

    val notification = buildNotification(currentTitle, currentMessage, currentType)
    
    // Always (re)assert foreground to satisfy timing constraints
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    
    ensureWakeLock()
    ensureWifiLock()
    
    startHeartbeat()
    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // On some Android 12 devices, re-start to remain alive after task swipe
    // IMPORTANT: Preserve the current notification state (incoming/outgoing/ongoing)
    try {
      val restartIntent = Intent(applicationContext, CallForegroundService::class.java).apply {
        putExtra(EXTRA_TITLE, currentTitle)
        putExtra(EXTRA_MESSAGE, currentMessage)
        putExtra(EXTRA_TYPE, currentType) 
      }
      androidx.core.content.ContextCompat.startForegroundService(applicationContext, restartIntent)
      Log.d("CallForegroundService", "Service restarted after task removed with type: $currentType")
    } catch (e: Exception) {
      Log.e("CallForegroundService", "Failed to restart service: ${e.message}", e)
    }
    super.onTaskRemoved(rootIntent)
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    super.onDestroy()
    Log.d("CallForegroundService", "onDestroy called")
    stopHeartbeat()
    stopNotificationChecker()
    try { wakeLock?.let { if (it.isHeld) it.release() } } catch (_: Throwable) {}
    try { wifiLock?.let { if (it.isHeld) it.release() } } catch (_: Throwable) {}
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      
      // Channel 1: Incoming calls (HIGH importance)
      val incomingChannel = NotificationChannel(
        CHANNEL_ID_INCOMING,
        CHANNEL_NAME_INCOMING,
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = CHANNEL_DESC_INCOMING
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      nm.createNotificationChannel(incomingChannel)
      
      // Channel 2: Ongoing calls (DEFAULT importance)
      val ongoingChannel = NotificationChannel(
        CHANNEL_ID_ONGOING,
        CHANNEL_NAME_ONGOING,
        NotificationManager.IMPORTANCE_DEFAULT
      ).apply {
        description = CHANNEL_DESC_ONGOING
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      nm.createNotificationChannel(ongoingChannel)
    }
  }

  private fun buildNotification(title: String, message: String, type: String): Notification {
    // Choose channel based on call type
    val channelId = if (type == CALL_TYPE_INCOMING) CHANNEL_ID_INCOMING else CHANNEL_ID_ONGOING
    
    val openIntent = Intent(this, MainActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    val contentIntent = PendingIntent.getActivity(
      this,
      0,
      openIntent,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      else PendingIntent.FLAG_UPDATE_CURRENT
    )

    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) 
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_UPDATE_CURRENT

    fun actionPendingIntent(action: String): PendingIntent {
      val intent = Intent(this, CallForegroundService::class.java).apply { this.action = action }
      return PendingIntent.getService(this, action.hashCode(), intent, flags)
    }

    val builder = NotificationCompat.Builder(this, channelId)
      .setContentTitle(title)
      .setContentText(message)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(contentIntent)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setCategory(Notification.CATEGORY_CALL)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setShowWhen(false)
      .setUsesChronometer(false)

    // Android 12+ specific behavior
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
    }

    // Android 12+ CallStyle for native call UI
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      // Create Person representing the caller/peer
      val person = Person.Builder()
        .setName(title)
        .setImportant(true)
        .build()

      when (type) {
        CALL_TYPE_INCOMING -> {
          // Use CallStyle.forIncomingCall with Accept and Reject actions
          val answerIntent = actionPendingIntent(ACTION_ACCEPT_CALL)
          val declineIntent = actionPendingIntent(ACTION_REJECT_CALL)
          
          val callStyle = NotificationCompat.CallStyle.forIncomingCall(
            person,
            declineIntent,
            answerIntent
          )
          builder.setStyle(callStyle)
        }
        CALL_TYPE_OUTGOING, CALL_TYPE_ONGOING -> {
          // Use CallStyle.forOngoingCall for outgoing and ongoing calls
          val hangUpIntent = actionPendingIntent(ACTION_END_CALL)
          val callStyle = NotificationCompat.CallStyle.forOngoingCall(
            person,
            hangUpIntent
          )
          builder.setStyle(callStyle)
        }
      }
    } else {
      // Fallback to standard action buttons for API < 31
      when (type) {
        CALL_TYPE_OUTGOING -> {
          builder.addAction(
            android.R.drawable.ic_menu_close_clear_cancel,
            "Cancel Call",
            actionPendingIntent(ACTION_END_CALL)
          )
        }
        CALL_TYPE_INCOMING -> {
          builder.addAction(
            android.R.drawable.ic_menu_call,
            "Accept",
            actionPendingIntent(ACTION_ACCEPT_CALL)
          )
          builder.addAction(
            android.R.drawable.ic_menu_close_clear_cancel,
            "Reject",
            actionPendingIntent(ACTION_REJECT_CALL)
          )
        }
        else -> { // ongoing
          builder.addAction(
            android.R.drawable.ic_menu_close_clear_cancel,
            "End Call",
            actionPendingIntent(ACTION_END_CALL)
          )
        }
      }
    }

    return builder.build()
  }

  companion object {
    // Dual notification channels
    private const val CHANNEL_ID_INCOMING = "call_incoming_channel"
    private const val CHANNEL_ID_ONGOING = "call_ongoing_channel"
    private const val CHANNEL_NAME_INCOMING = "Incoming Calls"
    private const val CHANNEL_NAME_ONGOING = "Ongoing Calls"
    private const val CHANNEL_DESC_INCOMING = "High priority incoming call notifications"
    private const val CHANNEL_DESC_ONGOING = "Ongoing call notifications"
    
    const val NOTIFICATION_ID = 1001
    
    // Intent extras - support both old and new parameter names
    const val EXTRA_CALL_TYPE = "callType" // legacy: "outgoing" | "incoming" | "ongoing"
    const val EXTRA_USERNAME = "username" // legacy
    const val EXTRA_TITLE = "title"
    const val EXTRA_MESSAGE = "message"
    const val EXTRA_TYPE = "type" // "outgoing" | "incoming" | "ongoing"
    
    const val CALL_TYPE_OUTGOING = "outgoing"
    const val CALL_TYPE_INCOMING = "incoming"
    const val CALL_TYPE_ONGOING = "ongoing"
    
    const val ACTION_END_CALL = "END_CALL"
    const val ACTION_ACCEPT_CALL = "ACCEPT_CALL"
    const val ACTION_REJECT_CALL = "REJECT_CALL"
    private const val DEFAULT_MESSAGE = "Tap to return to call"
  }

  private fun startHeartbeat() {
    if (heartbeatTimer != null) return
    Log.d("CallForegroundService", "Heartbeat started")
    try {
      heartbeatTimer = Timer("CallServiceHeartbeat", true).apply {
        scheduleAtFixedRate(object : TimerTask() {
          override fun run() {
            Log.d("CallForegroundService", "Heartbeat: service is alive")
          }
        }, 0L, 2500L)
      }
    } catch (t: Throwable) {
      Log.e("CallForegroundService", "Failed to start heartbeat: ${t.message}")
    }
  }

  private fun stopHeartbeat() {
    try {
      heartbeatTimer?.cancel()
      Log.d("CallForegroundService", "Heartbeat stopped")
    } catch (_: Throwable) {
    } finally {
      heartbeatTimer = null
    }
  }

  private fun ensureWakeLock() {
    try {
      if (wakeLock?.isHeld == true) return
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      val wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CallService:WakeLock")
      wl.setReferenceCounted(false)
      wl.acquire() //indefinite until manually released
      wakeLock = wl
    } catch (_: Throwable) {}
  }

  private fun ensureWifiLock() {
    try {
      if (wifiLock?.isHeld == true) return
      val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
      val wl = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "CallService:WifiLock")
      wl.setReferenceCounted(false)
      wl.acquire()
      wifiLock = wl
    } catch (_: Throwable) {}
  }

  private fun startNotificationChecker() {
    if (notificationCheckTimer != null) return
    
    Log.d("CallForegroundService", "Starting notification checker timer...")
    try {
      notificationCheckTimer = Timer("NotificationChecker", true)
      notificationCheckTimer?.scheduleAtFixedRate(object : TimerTask() {
        override fun run() {
          checkAndRepostNotification()
        }
      }, 3000L, 2000L) // Check every 2 seconds after 3 second delay
      
      Log.d("CallForegroundService", "Notification checker timer started")
    } catch (e: Exception) {
      Log.e("CallForegroundService", "Failed to start notification checker: ${e.message}")
    }
  }

  private fun stopNotificationChecker() {
    try {
      notificationCheckTimer?.cancel()
      Log.d("CallForegroundService", "Notification checker timer stopped")
    } catch (e: Exception) {
      Log.e("CallForegroundService", "Error stopping notification checker: ${e.message}")
    } finally {
      notificationCheckTimer = null
    }
  }

  private fun checkAndRepostNotification() {
    try {
      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val activeNotifications = notificationManager.activeNotifications
      
      var notificationExists = false
      for (notification in activeNotifications) {
        if (notification.id == NOTIFICATION_ID) {
          notificationExists = true
          break
        }
      }
      
      if (!notificationExists) {
        Log.d("CallForegroundService", "=== NOTIFICATION MISSING - RE-POSTING ===")
        Log.d("CallForegroundService", "Current title: ${currentTitle}")
        Log.d("CallForegroundService", "Current message: ${currentMessage}")
        Log.d("CallForegroundService", "Current type: ${currentType}")
        
        val notification = buildNotification(currentTitle, currentMessage, currentType)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          startForeground(
            NOTIFICATION_ID,
            notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
          )
        } else {
          startForeground(NOTIFICATION_ID, notification)
        }
        
        Log.d("CallForegroundService", "=== NOTIFICATION RE-POSTED ===")
      }
    } catch (e: Exception) {
      Log.e("CallForegroundService", "Error checking notification: ${e.message}", e)
    }
  }

  /**
   * Load call context from SharedPreferences.
   * This context is persisted by React Native via updateCallContext().
   */
  private fun loadCallContext() {
    try {
      val prefs = getSharedPreferences("call_context", Context.MODE_PRIVATE)
      val allKeys = prefs.all
      Log.d("NativeSocket", "Loading call context, available keys: ${allKeys.keys}")
      
      socketUrl = prefs.getString("socketUrl", null)
      accessToken = prefs.getString("accessToken", null)
      userId = prefs.getString("userId", null)
      callId = prefs.getString("callId", null)
      roomId = prefs.getString("roomId", null)
      clientCallId = prefs.getString("clientCallId", null)
      initiatorId = prefs.getString("initiatorId", null)
      callType = prefs.getString("callType", null)
      callState = prefs.getString("state", null)
      
      if (socketUrl == null || accessToken == null) {
        Log.w("NativeSocket", "⚠️ Critical context missing! socketUrl=$socketUrl, accessToken=$accessToken")
      } else {
        Log.d("NativeSocket", "✅ Context loaded: socketUrl=$socketUrl | userId=$userId | callId=$callId | roomId=$roomId")
      }
    } catch (e: Exception) {
      Log.e("NativeSocket", "Failed to load call context: ${e.message}", e)
    }
  }

  /**
   * Emit a socket event with payload using a temporary one-time connection.
   * Creates socket on-demand, emits event, then closes immediately.
   * This prevents interference with the React Native socket connection.
   */
  private fun emitEvent(event: String, payload: Map<String, Any?>) {
    if (socketUrl.isNullOrBlank() || accessToken.isNullOrBlank()) {
      Log.e("NativeSocket", "Cannot emit $event: missing socketUrl or accessToken")
      clearPersistedCallState()
      stopSelf()
      return
    }
    
    // Filter out null values from payload
    val filteredPayload = payload.filterValues { it != null }
    val jsonPayload = JSONObject(filteredPayload)
    
    Log.d("NativeSocket", "Creating temporary socket connection for event: $event")
    
    try {
      // Create a temporary socket for this single event
      val opts = IO.Options().apply {
        query = "token=$accessToken"
        reconnection = false  // Don't reconnect - this is one-time use
        timeout = 5000
      }
      
      val tempSocket = IO.socket(socketUrl ?: return, opts)
      
      tempSocket.once(Socket.EVENT_CONNECT) {
        Log.d("NativeSocket", "✅ Temporary socket connected, emitting $event: $jsonPayload")
        tempSocket.emit(event, jsonPayload)
        
        // Close immediately after emitting
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
          tempSocket.disconnect()
          tempSocket.close()
          Log.d("NativeSocket", "✅ Temporary socket closed after emitting $event")
          
          // Clear persisted call state to prevent ghost calls when app reopens
          clearPersistedCallState()
          
          stopSelf()
        }, 500)  // Small delay to ensure event is sent
      }
      
      tempSocket.on(Socket.EVENT_CONNECT_ERROR) { args ->
        Log.e("NativeSocket", "❌ Failed to connect temporary socket: ${args.joinToString()}")
        tempSocket.close()
        clearPersistedCallState()
        stopSelf()
      }
      
      tempSocket.connect()
      
    } catch (e: Exception) {
      Log.e("NativeSocket", "❌ Error creating temporary socket: ${e.message}", e)
      clearPersistedCallState()
      stopSelf()
    }
  }

  /**
   * Clear persisted call state and set a flag that native ended the call.
   * This prevents "ghost calls" from appearing when the app is reopened.
   * 
   * Strategy: Instead of trying to manipulate React Native's AsyncStorage 
   * (which is fragile and version-dependent), we:
   * 1. Set a "nativeEndedCall" flag FIRST (while we still have the callId)
   * 2. Then clear our own call_context
   * 3. React Native checks this flag on startup and ignores stale calls
   */
  private fun clearPersistedCallState() {
    try {
      Log.d("NativeSocket", "Clearing persisted call state for callId: $callId")
      
      // IMPORTANT: Set flag BEFORE clearing context (while we still have callId)
      if (callId != null) {
        val nativeCallEndPrefs = getSharedPreferences("native_call_actions", Context.MODE_PRIVATE)
        nativeCallEndPrefs.edit()
          .putLong("lastNativeEndCallTimestamp", System.currentTimeMillis())
          .putString("lastEndedCallId", callId)
          .apply()
        Log.d("NativeSocket", "✅ Set nativeEndedCall flag for callId: $callId")
      } else {
        Log.w("NativeSocket", "⚠️ Cannot set nativeEndedCall flag: callId is null")
      }
      
      // Now clear call_context SharedPreferences (our native storage)
      val callContextPrefs = getSharedPreferences("call_context", Context.MODE_PRIVATE)
      callContextPrefs.edit().clear().apply()
      Log.d("NativeSocket", "✅ Cleared call_context SharedPreferences")
      
    } catch (e: Exception) {
      Log.e("NativeSocket", "❌ Error clearing persisted call state: ${e.message}", e)
    }
  }

}
