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

  override fun onCreate() {
    super.onCreate()
    Log.d("CallForegroundService", "onCreate called")
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
    try {
      val restartIntent = Intent(applicationContext, CallForegroundService::class.java)
      androidx.core.content.ContextCompat.startForegroundService(applicationContext, restartIntent)
    } catch (_: Throwable) {}
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

}
