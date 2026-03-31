import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(userId: string) {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Standard",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const token = (
    await Notifications.getExpoPushTokenAsync({
      projectId: "godenaboer-app",
    })
  ).data;

  const { error } = await supabase.auth.updateUser({
    data: { expo_push_token: token },
  });

  if (error) {
    console.log("Kunne ikke lagre push-token:", error.message);
  }

  return token;
}
