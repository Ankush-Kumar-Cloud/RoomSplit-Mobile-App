// Google OAuth Configuration
// Replace with your Google Cloud Console Client IDs
export const GOOGLE_AUTH_CONFIG = {
  // Web Client ID (Works in Expo Go and Web)
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
  // Android Client ID (For standalone APK)
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "",
  // iOS Client ID (Optional)
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "",
};
