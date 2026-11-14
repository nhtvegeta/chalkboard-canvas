# Capacitor & WebView ProGuard Rules
-keep public class * extends com.getcapacitor.Plugin
-keep public class com.getcapacitor.** { *; }
-keep public class * implements com.getcapacitor.PluginMethod
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keepattributes *Annotation*
-dontwarn com.getcapacitor.**
-keepattributes SourceFile,LineNumberTable
-keep class com.chalkboard.canvas.** { *; }
