# Raccoon Sky Jump — R8 / ProGuard rules
# minifyEnabled=true + shrinkResources=true are on for release builds.
# These keeps make sure the Capacitor bridge, its plugins and the WebView
# JavaScript interface survive obfuscation. Without them the game shows a
# white screen in release because the JS<->native bridge methods get renamed.

# ---- Capacitor core bridge -------------------------------------------------
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.PluginMethod public <methods>;
}
-keep public class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public <methods>;
}

# ---- Installed Capacitor plugins ------------------------------------------
-keep class com.capacitorjs.plugins.** { *; }

# ---- Cordova compatibility layer (present even when unused) ---------------
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# ---- WebView JavaScript bridge --------------------------------------------
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ---- App entry point ------------------------------------------------------
-keep class com.raccoonskyjump.game.MainActivity { *; }

# ---- AdMob / Firebase (uncomment when the real SDKs are added) ------------
# -keep class com.google.android.gms.ads.** { *; }
# -keep class com.google.firebase.** { *; }
# -dontwarn com.google.android.gms.**
# -dontwarn com.google.firebase.**
