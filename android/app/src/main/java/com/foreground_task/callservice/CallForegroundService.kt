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

class CallForegroundService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null
  private var wifiLock: WifiManager.WifiLock? = null

  override fun onCreate() {
    super.onCreate()
    Log.d("CallForegroundService", "onCreate called")
    ensureChannel()
    // Start immediately with minimal notification to satisfy 5s requirement on some OEMs
    try {
      val notification = buildNotification(DEFAULT_TITLE, DEFAULT_MESSAGE)
      startForeground(NOTIFICATION_ID, notification)
    } catch (_: Throwable) {}
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    Log.d("CallForegroundService", "onStartCommand called")
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: DEFAULT_TITLE
    val message = intent?.getStringExtra(EXTRA_MESSAGE) ?: DEFAULT_MESSAGE
    val notification = buildNotification(title, message)
    // Always (re)assert foreground to satisfy timing constraints
    startForeground(NOTIFICATION_ID, notification)
    ensureWakeLock()
    ensureWifiLock()
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
    try { wakeLock?.let { if (it.isHeld) it.release() } } catch (_: Throwable) {}
    try { wifiLock?.let { if (it.isHeld) it.release() } } catch (_: Throwable) {}
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        CHANNEL_NAME,
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = CHANNEL_DESC
        setSound(null, null)
        enableVibration(false)
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

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(message)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(contentIntent)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  companion object {
    private const val CHANNEL_ID = "call_foreground_channel"
    private const val CHANNEL_NAME = "Call Service"
    private const val CHANNEL_DESC = "Keeps ongoing calls active"
    private const val NOTIFICATION_ID = 1001
    const val EXTRA_TITLE = "title"
    const val EXTRA_MESSAGE = "message"
    private const val DEFAULT_TITLE = "Ongoing call"
    private const val DEFAULT_MESSAGE = "Tap to return to call"
  }

  private fun ensureWakeLock() {
    try {
      if (wakeLock?.isHeld == true) return
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      val wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CallService:WakeLock")
      wl.setReferenceCounted(false)
      wl.acquire(10 * 60 * 1000L /* 10 minutes */)
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

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val serviceChannel = NotificationChannel(
        CHANNEL_ID,
        "Foreground Service Channel",
        NotificationManager.IMPORTANCE_DEFAULT
      )
      val manager = getSystemService<NotificationManager?>(NotificationManager::class.java)
      if (manager != null) {
        manager.createNotificationChannel(serviceChannel)
      }
    }
  }
}


