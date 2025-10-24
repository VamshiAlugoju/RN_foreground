package com.foreground_task.callservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
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
  private var currentCallType: String = CALL_TYPE_ONGOING
  private var currentUsername: String = ""

  override fun onCreate() {
    super.onCreate()
    Log.d("CallForegroundService", "onCreate called")
    ensureChannel()
    startNotificationChecker()
    // Start immediately with minimal notification to satisfy 5s requirement on some OEMs
    try {
      val notification = buildNotification(CALL_TYPE_ONGOING, currentUsername)
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
        val ongoing = buildNotification(currentCallType, currentUsername)
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

    // Read extras for notification content/type updates
    val callTypeExtra = intent?.getStringExtra(EXTRA_CALL_TYPE) ?: intent?.getStringExtra("callType") ?: CALL_TYPE_ONGOING
    val usernameExtra = intent?.getStringExtra(EXTRA_USERNAME) ?: intent?.getStringExtra("username") ?: ""
    val normalizedType = when (callTypeExtra.lowercase()) {
      CALL_TYPE_OUTGOING -> CALL_TYPE_OUTGOING
      CALL_TYPE_INCOMING -> CALL_TYPE_INCOMING
      else -> CALL_TYPE_ONGOING
    }

    currentCallType = normalizedType
    currentUsername = usernameExtra

    val notification = buildNotification(currentCallType, currentUsername)
    
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
      val channel = NotificationChannel(
        CHANNEL_ID,
        CHANNEL_NAME,
        NotificationManager.IMPORTANCE_DEFAULT
      ).apply {
        description = CHANNEL_DESC
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.createNotificationChannel(channel)
    }
  }

  private fun buildNotification(callType: String, username: String): Notification {
    val safeUsername = username.ifBlank { "" }
    val (title, message) = when (callType) {
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

    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(message)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(contentIntent)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setCategory(Notification.CATEGORY_CALL)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setShowWhen(false)  // Don't show timestamp
      .setUsesChronometer(false)  // Don't show chronometer

    // Android 12+ specific behavior
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
    }

    // Add action buttons per call type
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) 
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_UPDATE_CURRENT

    fun actionPendingIntent(action: String): PendingIntent {
      val intent = Intent(this, CallForegroundService::class.java).apply { this.action = action }
      return PendingIntent.getService(this, action.hashCode(), intent, flags)
    }

    when (callType) {
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

    val notification = builder.build()
    return notification
  }

  companion object {
    private const val CHANNEL_ID = "call_foreground_channel"
    private const val CHANNEL_NAME = "Call Service"
    private const val CHANNEL_DESC = "Keeps ongoing calls active"
    const val NOTIFICATION_ID = 1001
    const val EXTRA_CALL_TYPE = "callType" // "outgoing" | "incoming" | "ongoing"
    const val EXTRA_USERNAME = "username"
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
        Log.d("CallForegroundService", "Current type: ${currentCallType}")
        Log.d("CallForegroundService", "Current user: ${currentUsername}")
        
        val notification = buildNotification(currentCallType, currentUsername)
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
