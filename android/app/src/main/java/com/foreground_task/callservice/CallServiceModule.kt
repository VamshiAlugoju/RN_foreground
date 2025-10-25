package com.foreground_task.callservice

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Dynamic
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.facebook.react.modules.core.DeviceEventManagerModule

class CallServiceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CallService"

    companion object {
        private var instance: CallServiceModule? = null
        fun getInstance(): CallServiceModule? = instance
    }

    init {
        instance = this
    }

    private fun sendEvent(eventName: String) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, null)
        } else {
            Log.w("CallServiceModule", "React context not active. Event $eventName not sent.")
        }
    }

    fun emitCallAcceptedEvent() { sendEvent("CALL_ACCEPTED_FROM_NOTIFICATION") }
    fun emitCallRejectedEvent() { sendEvent("CALL_REJECTED_FROM_NOTIFICATION") }
    fun emitCallEndedEvent() { sendEvent("CALL_ENDED_FROM_NOTIFICATION") }
    
    /**
     * Check if React Native is truly alive and can handle events.
     * Not just if the context exists, but if the UI Activity is in the foreground.
     * Used by CallForegroundService to determine whether to use RN bridge or native socket fallback.
     */
    fun isReactNativeAlive(): Boolean {
        return try {
            // Check if context exists and has active Catalyst instance
            if (reactContext == null || !reactContext.hasActiveCatalystInstance()) {
                return false
            }
            
            // Check if the current activity is in the foreground/resumed state
            val activity = reactContext.currentActivity
            if (activity == null) {
                Log.d("CallServiceModule", "No current activity - RN not alive")
                return false
            }
            
            // Activity must be resumed (visible and interactive)
            val isResumed = !activity.isFinishing && !activity.isDestroyed
            Log.d("CallServiceModule", "Activity state: finishing=${activity.isFinishing}, destroyed=${activity.isDestroyed}, result=$isResumed")
            
            isResumed
        } catch (e: Exception) {
            Log.e("CallServiceModule", "Error checking RN state: ${e.message}")
            false
        }
    }


    @ReactMethod
    fun startForegroundService(callType: String?, username: String?) {
      Log.d("CallForegroundService", "Service starting...")
      val ctx = reactContext
        val i = Intent(ctx, CallForegroundService::class.java).apply {
            putExtra(CallForegroundService.EXTRA_CALL_TYPE, callType)
            putExtra(CallForegroundService.EXTRA_USERNAME, username)
        }
      ContextCompat.startForegroundService(ctx, i)
      Log.d("CallForegroundService", "Service started")
  }

    @ReactMethod
    fun stopForegroundService() {
        Log.d("CallForegroundService", "Service stopping...")
        val ctx = reactContext
        ctx.stopService(Intent(ctx, CallForegroundService::class.java))
        Log.d("CallForegroundService", "Service stopped")
    }

    /**
     * Get the callId of the last call ended by native while RN was dead.
     * Returns null if no native call end action occurred.
     */
    @ReactMethod
    fun getLastNativeEndedCallId(callback: com.facebook.react.bridge.Callback) {
        try {
            val prefs = reactContext.getSharedPreferences("native_call_actions", Context.MODE_PRIVATE)
            val callId = prefs.getString("lastEndedCallId", null)
            val timestamp = prefs.getLong("lastNativeEndCallTimestamp", 0)
            
            // Convert Long to Double for JavaScript compatibility
            val timestampDouble = timestamp.toDouble()
            callback.invoke(callId, timestampDouble)
        } catch (e: Exception) {
            Log.e("CallServiceModule", "Error getting native ended call: ${e.message}", e)
            callback.invoke(null, 0.0)
        }
    }

    /**
     * Updates the current call context and persists it to SharedPreferences.
     * This allows the native side to handle actions even if React Native is dead.
     * Stores call metadata like tokens, IDs, socket URL, etc.
     */
    @ReactMethod
    fun updateCallContext(params: ReadableMap) {
        val prefs = reactContext.getSharedPreferences("call_context", Context.MODE_PRIVATE)
        val editor = prefs.edit()
        
        val iterator = params.keySetIterator()
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            val value = params.getDynamic(key)
            
            when (value.type) {
                ReadableType.String -> editor.putString(key, value.asString())
                ReadableType.Number -> editor.putFloat(key, value.asDouble().toFloat())
                ReadableType.Boolean -> editor.putBoolean(key, value.asBoolean())
                ReadableType.Null -> editor.remove(key)
                else -> {
                    Log.w("CallServiceModule", "Unsupported type for key: $key")
                }
            }
        }
        
        editor.apply()
        Log.d("CallServiceModule", "Call context updated with keys: ${params.toHashMap().keys}")
    }

}


