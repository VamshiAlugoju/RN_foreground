package com.foreground_task.callservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.foreground_task.MainActivity
import com.foreground_task.R
import java.util.Timer
import java.util.TimerTask

class CallForegroundService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null
  private var wifiLock: WifiManager.WifiLock? = null
  private var heartbeatTimer: Timer? = null
  private var notificationCheckTimer: Timer? = null
  private var currentTitle: String = DEFAULT_TITLE
  private var currentMessage: String = DEFAULT_MESSAGE

  override fun onCreate() {
    super.onCreate()
    Log.d("CallForegroundService", "onCreate called")
    ensureChannel()
    startNotificationChecker()
    // Start immediately with minimal notification to satisfy 5s requirement on some OEMs
    try {
      val notification = buildNotification(DEFAULT_TITLE, DEFAULT_MESSAGE)
      startForeground(NOTIFICATION_ID, notification)
    } catch (_: Throwable) {}
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    Log.d("CallForegroundService", "onStartCommand")
    
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: DEFAULT_TITLE
    val message = intent?.getStringExtra(EXTRA_MESSAGE) ?: DEFAULT_MESSAGE
    
    // Store current title and message for re-posting
    currentTitle = title
    currentMessage = message
    
    val notification = buildNotification(title, message)
    
    // Always (re)assert foreground to satisfy timing constraints
    startForeground(NOTIFICATION_ID, notification)
    
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

  private fun buildNotification(title: String, message: String): Notification {
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

    val notification = builder.build()
    
    return notification
  }

  companion object {
    private const val CHANNEL_ID = "call_foreground_channel"
    private const val CHANNEL_NAME = "Call Service"
    private const val CHANNEL_DESC = "Keeps ongoing calls active"
    const val NOTIFICATION_ID = 1001
    const val EXTRA_TITLE = "title"
    const val EXTRA_MESSAGE = "message"
    private const val DEFAULT_TITLE = "Ongoing call"
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
        
        val notification = buildNotification(currentTitle, currentMessage)
        startForeground(NOTIFICATION_ID, notification)
        
        Log.d("CallForegroundService", "=== NOTIFICATION RE-POSTED ===")
      }
    } catch (e: Exception) {
      Log.e("CallForegroundService", "Error checking notification: ${e.message}", e)
    }
  }

}
