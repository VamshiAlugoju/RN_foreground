package com.foreground_task.locationsharing

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.foreground_task.MainActivity
import com.foreground_task.R
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URI
import java.util.Timer
import java.util.TimerTask



import android.location.Location
import android.location.LocationManager
import android.content.pm.PackageManager

class LocationSharingService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null
  private var wifiLock: WifiManager.WifiLock? = null
  private var notificationCheckTimer: Timer? = null
  private var locationTimer: Timer? = null
  private var socket: Socket? = null
  private var currentTitle: String = DEFAULT_TITLE
  private var currentMessage: String = DEFAULT_MESSAGE
  private var socketUrl: String = ""
  private var authToken: String = ""
  private var userId: String = ""
  private var recieverId: String = ""
  private var username: String = ""
  private var lastLat: Double? = null
  private var lastLon: Double? = null

  override fun onCreate() {
    super.onCreate()
    Log.d("LocationSharingService", "onCreate called")
    ensureChannel()
    startNotificationChecker()
    try {
      val notification = buildNotification(DEFAULT_TITLE, DEFAULT_MESSAGE)
      startForeground(NOTIFICATION_ID, notification)
    } catch (_: Throwable) {}
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    Log.d("LocationSharingService", "onStartCommand")

    // Handle stop location sharing action
    when (intent?.action) {
      "STOP_LOCATION_SHARING" -> {
        Log.d("LocationSharingService", "Stop location sharing requested")
        stopLocationSharing()
        clearSessionData() // Ensure session data is cleared when stopped via notification
        
        // Emit event to notify React Native that service was stopped via notification
        try {
          LocationSharingModule.getInstance()?.emitServiceStoppedEvent()
        } catch (e: Exception) {
          Log.e("LocationSharingService", "Error emitting service stopped event: ${e.message}")
        }
        
        stopSelf()
        return START_NOT_STICKY
      }
    }

    val title = intent?.getStringExtra(EXTRA_TITLE) ?: DEFAULT_TITLE
    val message = intent?.getStringExtra(EXTRA_MESSAGE) ?: DEFAULT_MESSAGE
    socketUrl = intent?.getStringExtra(EXTRA_SOCKET_URL) ?: ""
    authToken = intent?.getStringExtra(EXTRA_AUTH_TOKEN) ?: ""
    userId = intent?.getStringExtra(EXTRA_USER_ID) ?: ""
    recieverId = intent?.getStringExtra(EXTRA_RECEIVER_ID) ?: ""
    username = intent?.getStringExtra(EXTRA_USERNAME) ?: ""
    
    // If session data is empty, try to load from SharedPreferences
    if (socketUrl.isEmpty() || authToken.isEmpty() || userId.isEmpty() || recieverId.isEmpty() || username.isEmpty()) {
      loadSessionData()
    }

    currentTitle = title
    currentMessage = message

    val notification = buildNotification(title, message)
    startForeground(NOTIFICATION_ID, notification)

    ensureWakeLock()
    ensureWifiLock()

    startLocationSharing()
    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    try {
      // Save session data to SharedPreferences
      saveSessionData()
      
      val restartIntent = Intent(applicationContext, LocationSharingService::class.java)
      // Pass the saved session data
      restartIntent.putExtra(EXTRA_SOCKET_URL, socketUrl)
      restartIntent.putExtra(EXTRA_AUTH_TOKEN, authToken)
      restartIntent.putExtra(EXTRA_USER_ID, userId)
      restartIntent.putExtra(EXTRA_RECEIVER_ID, recieverId)
      restartIntent.putExtra(EXTRA_USERNAME, username)
      restartIntent.putExtra(EXTRA_TITLE, currentTitle)
      restartIntent.putExtra(EXTRA_MESSAGE, currentMessage)
      
      androidx.core.content.ContextCompat.startForegroundService(applicationContext, restartIntent)
    } catch (_: Throwable) {}
    super.onTaskRemoved(rootIntent)
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    super.onDestroy()
    Log.d("LocationSharingService", "onDestroy called")
    stopNotificationChecker()
    stopLocationSharing()
    try { wakeLock?.let { if (it.isHeld) it.release() } } catch (_: Throwable) {}
    try { wifiLock?.let { if (it.isHeld) it.release() } } catch (_: Throwable) {}
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        CHANNEL_NAME,
        NotificationManager.IMPORTANCE_LOW // Low importance to prevent pop-ups
      ).apply {
        description = CHANNEL_DESC
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        setBypassDnd(false) // Don't bypass DND to prevent pop-ups
        setShowBadge(false) // Don't show badge
      }
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.createNotificationChannel(channel)
    }
  }

  private fun buildNotification(title: String, message: String): Notification {
    // Build deep link to LocationDebug screen with last coordinates if available
    val lat = lastLat
    val lon = lastLon
    val uri: Uri = if (lat != null && lon != null) {
      Uri.parse("foreground://location?lat=$lat&lon=$lon")
    } else {
      Uri.parse("foreground://location")
    }
    val openIntent = Intent(Intent.ACTION_VIEW, uri).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      `package` = packageName
    }
    val contentIntent = PendingIntent.getActivity(
      this,
      0,
      openIntent,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      else PendingIntent.FLAG_UPDATE_CURRENT
    )

    // Stop sharing action button
    val stopIntent = Intent(this, LocationSharingService::class.java).apply {
      action = "STOP_LOCATION_SHARING"
    }
    val stopPendingIntent = PendingIntent.getService(
      this,
      1,
      stopIntent,
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
      .setPriority(NotificationCompat.PRIORITY_LOW) // Low priority to prevent pop-ups
      .setCategory(Notification.CATEGORY_SERVICE) // Use SERVICE category for foreground services
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setShowWhen(false)
      .setUsesChronometer(false)
      .addAction(
        0, // No icon
        "Stop sharing location",
        stopPendingIntent
      )

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
    }

    // Additional settings to prevent pop-ups and ensure non-dismissable
    builder.setLocalOnly(true) // Don't show on external devices
    builder.setSilent(true) // Silent notification
    
    // Android 15+ non-dismissable notification
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
      builder.setOngoing(true)
      builder.setAutoCancel(false)
      builder.setDeleteIntent(null) // Prevent dismissal
    }

    val notification = builder.build()

    return notification
  }

  companion object {
    private const val CHANNEL_ID = "location_sharing_channel"
    private const val CHANNEL_NAME = "Location Sharing"
    private const val CHANNEL_DESC = "Shares live location in background"
    const val NOTIFICATION_ID = 1101
    const val EXTRA_TITLE = "title"
    const val EXTRA_MESSAGE = "message"
    const val EXTRA_SOCKET_URL = "socketUrl"
    const val EXTRA_AUTH_TOKEN = "authToken"
    const val EXTRA_USER_ID = "userId"
    const val EXTRA_RECEIVER_ID = "recieverId"
    const val EXTRA_USERNAME = "username"
    private const val DEFAULT_TITLE = "Location sharing active"
    private const val DEFAULT_MESSAGE = "Tap to return to app"
  }


  private fun ensureWakeLock() {
    try {
      if (wakeLock?.isHeld == true) return
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      val wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "LocationService:WakeLock")
      wl.setReferenceCounted(false)
      wl.acquire()
      wakeLock = wl
    } catch (_: Throwable) {}
  }

  private fun ensureWifiLock() {
    try {
      if (wifiLock?.isHeld == true) return
      val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
      val wl = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "LocationService:WifiLock")
      wl.setReferenceCounted(false)
      wl.acquire()
      wifiLock = wl
    } catch (_: Throwable) {}
  }

  private fun startNotificationChecker() {
    if (notificationCheckTimer != null) return

    Log.d("LocationSharingService", "Starting notification checker timer...")
    try {
      notificationCheckTimer = Timer("LocationNotificationChecker", true)
      notificationCheckTimer?.scheduleAtFixedRate(object : TimerTask() {
        override fun run() {
          checkAndRepostNotification()
        }
      }, 3000L, 2000L)

      Log.d("LocationSharingService", "Notification checker timer started")
    } catch (e: Exception) {
      Log.e("LocationSharingService", "Failed to start notification checker: ${e.message}")
    }
  }

  private fun stopNotificationChecker() {
    try {
      notificationCheckTimer?.cancel()
      Log.d("LocationSharingService", "Notification checker timer stopped")
    } catch (e: Exception) {
      Log.e("LocationSharingService", "Error stopping notification checker: ${e.message}")
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
        Log.d("LocationSharingService", "=== NOTIFICATION MISSING - RE-POSTING ===")
        Log.d("LocationSharingService", "Current title: ${currentTitle}")
        Log.d("LocationSharingService", "Current message: ${currentMessage}")

        val notification = buildNotification(currentTitle, currentMessage)
        startForeground(NOTIFICATION_ID, notification)

        Log.d("LocationSharingService", "=== NOTIFICATION RE-POSTED ===")
      }
    } catch (e: Exception) {
      Log.e("LocationSharingService", "Error checking notification: ${e.message}", e)
    }
  }

  private fun startLocationSharing() {
    if (socketUrl.isEmpty() || authToken.isEmpty() || userId.isEmpty() || recieverId.isEmpty() || username.isEmpty()) {
      Log.e("LocationSharingService", "Missing session data, cannot start location sharing")
      return
    }

    try {
      // Initialize socket connection
      val socketOptions = IO.Options().apply {
        transports = arrayOf("websocket", "polling")
        forceNew = true
      }
      
      val url = "$socketUrl?token=$authToken"
      Log.d("LocationSharingService", "Connecting to socket: $url")
      
      socket = IO.socket(URI.create(url), socketOptions)
      
      // Handle connection events
      socket?.on(Socket.EVENT_CONNECT) {
        Log.d("LocationSharingService", "Socket connected successfully")
        // Wait for authentication before starting location timer
      }
      
      socket?.on(Socket.EVENT_DISCONNECT) {
        Log.d("LocationSharingService", "Socket disconnected")
        stopLocationTimer()
      }
      
      socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
        Log.e("LocationSharingService", "Socket connection error: ${args.contentToString()}")
      }
      
      // Handle authentication events (CRITICAL)
      socket?.on("authenticated") {
        Log.d("LocationSharingService", "Socket authenticated successfully - starting location sharing")
        startLocationTimer()
      }
      
      socket?.on("auth_error") { args ->
        Log.e("LocationSharingService", "Socket authentication error: ${args.contentToString()}")
      }
      
      
      socket?.connect()
      
    } catch (e: Exception) {
      Log.e("LocationSharingService", "Failed to start location sharing: ${e.message}", e)
    }
  }

  private fun stopLocationSharing() {
    try {
      stopLocationTimer()
      socket?.disconnect()
      socket = null
      clearSessionData()
      Log.d("LocationSharingService", "Location sharing stopped")
    } catch (e: Exception) {
      Log.e("LocationSharingService", "Error stopping location sharing: ${e.message}", e)
    }
  }

  private fun startLocationTimer() {
    if (locationTimer != null) return
    
    Log.d("LocationSharingService", "Starting location timer")
    try {
      locationTimer = Timer("LocationTimer", true).apply {
        scheduleAtFixedRate(object : TimerTask() {
          override fun run() {
            generateAndSendLocation()
          }
        }, 0L, 2000L) // Every 2 seconds
      }
    } catch (e: Exception) {
      Log.e("LocationSharingService", "Failed to start location timer: ${e.message}", e)
    }
  }

  private fun stopLocationTimer() {
    try {
      locationTimer?.cancel()
      locationTimer = null
      Log.d("LocationSharingService", "Location timer stopped")
    } catch (e: Exception) {
      Log.e("LocationSharingService", "Error stopping location timer: ${e.message}", e)
    }
  }

  private fun generateAndSendLocation() {
    try {
        if (socket?.connected() != true) {
            Log.w("LocationSharingService", "Socket not connected, skipping location emit")
            return
        }

        val locationManager = getSystemService(Context.LOCATION_SERVICE) as android.location.LocationManager

        // Check permissions first
        val hasFine = checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED
        val hasCoarse = checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (!hasFine && !hasCoarse) {
            Log.e("LocationSharingService", "Location permission not granted")
            return
        }

        // Try to get last known location from GPS, fallback to Network
        val gpsLocation = locationManager.getLastKnownLocation(android.location.LocationManager.GPS_PROVIDER)
        val netLocation = locationManager.getLastKnownLocation(android.location.LocationManager.NETWORK_PROVIDER)

        val bestLocation = when {
            gpsLocation != null && netLocation != null ->
                if (gpsLocation.time > netLocation.time) gpsLocation else netLocation
            gpsLocation != null -> gpsLocation
            netLocation != null -> netLocation
            else -> null
        }

        if (bestLocation == null) {
            Log.w("LocationSharingService", "No valid location available yet")
            return
        }

        val latitude = bestLocation.latitude
        val longitude = bestLocation.longitude

        // Remember for deep link
        lastLat = latitude
        lastLon = longitude

        // Update foreground notification
        val notification = buildNotification(currentTitle, currentMessage)
        startForeground(NOTIFICATION_ID, notification)

        // Prepare and emit data
        val locationData = org.json.JSONObject().apply {
            put("recieverId", recieverId)
            put("latitude", latitude)
            put("longitude", longitude)
            put("username", username)
        }

        socket?.emit("shareLocation", locationData)
        Log.d("LocationSharingService", "📍 Sent: lat=$latitude, lon=$longitude")
    } catch (e: Exception) {
        Log.e("LocationSharingService", "Error sending real location: ${e.message}", e)
    }
  }

  private fun saveSessionData() {
    try {
      val prefs = getSharedPreferences("LocationSharingService", Context.MODE_PRIVATE)
      prefs.edit().apply {
        putString("socketUrl", socketUrl)
        putString("authToken", authToken)
        putString("userId", userId)
        putString("recieverId", recieverId)
        putString("username", username)
        putString("currentTitle", currentTitle)
        putString("currentMessage", currentMessage)
        apply()
      }
    } catch (e: Exception) {
      Log.e("LocationSharingService", "Error saving session data: ${e.message}", e)
    }
  }

  private fun loadSessionData() {
    try {
      val prefs = getSharedPreferences("LocationSharingService", Context.MODE_PRIVATE)
      socketUrl = prefs.getString("socketUrl", "") ?: ""
      authToken = prefs.getString("authToken", "") ?: ""
      userId = prefs.getString("userId", "") ?: ""
      recieverId = prefs.getString("recieverId", "") ?: ""
      username = prefs.getString("username", "") ?: ""
      currentTitle = prefs.getString("currentTitle", DEFAULT_TITLE) ?: DEFAULT_TITLE
      currentMessage = prefs.getString("currentMessage", DEFAULT_MESSAGE) ?: DEFAULT_MESSAGE
      
    } catch (e: Exception) {
      Log.e("LocationSharingService", "Error loading session data: ${e.message}", e)
    }
  }

  private fun clearSessionData() {
    try {
      val prefs = getSharedPreferences("LocationSharingService", Context.MODE_PRIVATE)
      prefs.edit().clear().apply()
      Log.d("LocationSharingService", "Session data cleared")
    } catch (e: Exception) {
      Log.e("LocationSharingService", "Error clearing session data: ${e.message}", e)
    }
  }
}


