package com.foreground_task.callservice

import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
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

}


