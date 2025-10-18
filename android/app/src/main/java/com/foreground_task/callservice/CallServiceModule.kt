package com.foreground_task.callservice

import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CallServiceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CallService"

    @ReactMethod
    fun startForegroundService(title: String, message: String) {
        Log.d("CallForegroundService", "Service starting...")
        val ctx = reactContext
        val i = Intent(ctx, CallForegroundService::class.java).apply {
            putExtra(CallForegroundService.EXTRA_TITLE, title)
            putExtra(CallForegroundService.EXTRA_MESSAGE, message)
        }
        // Avoid duplicate starts in quick succession by stopping first if already running
        try {
            ctx.stopService(Intent(ctx, CallForegroundService::class.java))
        } catch (_: Throwable) {
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


