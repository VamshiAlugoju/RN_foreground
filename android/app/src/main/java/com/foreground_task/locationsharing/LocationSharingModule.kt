package com.foreground_task.locationsharing

import android.content.Intent
import android.content.Context
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class LocationSharingModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "LocationSharing"

    companion object {
        private var instance: LocationSharingModule? = null
        
        fun getInstance(): LocationSharingModule? = instance
    }

    init {
        instance = this
    }

    private fun sendEvent(eventName: String, params: WritableMap? = null) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
        } else {
            Log.w("LocationSharingModule", "React context not active. Event $eventName not sent.")
        }
    }
    
    fun emitServiceStoppedEvent() {
        sendEvent("LocationSharingServiceStopped")
    }

    @ReactMethod
    fun startForegroundService(title: String, message: String, socketUrl: String, authToken: String, userId: String, recieverId: String, username: String) {
        Log.d("LocationSharingService", "Service starting with session data...")
        val ctx = reactContext
        val i = Intent(ctx, LocationSharingService::class.java).apply {
            putExtra(LocationSharingService.EXTRA_TITLE, title)
            putExtra(LocationSharingService.EXTRA_MESSAGE, message)
            putExtra(LocationSharingService.EXTRA_SOCKET_URL, socketUrl)
            putExtra(LocationSharingService.EXTRA_AUTH_TOKEN, authToken)
            putExtra(LocationSharingService.EXTRA_USER_ID, userId)
            putExtra(LocationSharingService.EXTRA_RECEIVER_ID, recieverId)
            putExtra(LocationSharingService.EXTRA_USERNAME, username)
        }
        ContextCompat.startForegroundService(ctx, i)
        Log.d("LocationSharingService", "Service started with session data")
    }

    @ReactMethod
    fun stopForegroundService() {
        Log.d("LocationSharingService", "Service stopping...")
        val ctx = reactContext
        ctx.stopService(Intent(ctx, LocationSharingService::class.java))
        Log.d("LocationSharingService", "Service stopped")
    }

    @ReactMethod
    fun isServiceRunning(promise: Promise) {
        try {
            val activityManager = reactContext.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager
            val runningServices = activityManager.getRunningServices(Integer.MAX_VALUE)
            
            val isRunning = runningServices.any { serviceInfo ->
                serviceInfo.service.className == LocationSharingService::class.java.name
            }
            
            Log.d("LocationSharingModule", "Service running status: $isRunning")
            promise.resolve(isRunning)
        } catch (e: Exception) {
            Log.e("LocationSharingModule", "Error checking service status: ${e.message}", e)
            promise.resolve(false)
        }
    }
}


