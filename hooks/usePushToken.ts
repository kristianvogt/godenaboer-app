import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";

export function usePushToken(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    if (Constants.appOwnership === "expo") return;
    if (!Device.isDevice) return;

    let cancelled = false;

    (async () => {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") return;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants.easConfig as { projectId?: string } | undefined)?.projectId;

      const { data: token } = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );

      if (cancelled || !token) return;

      const { error } = await supabase.from("push_tokens").upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS,
        },
        { onConflict: "user_id,token" },
      );

      if (error) {
        console.log("Kunne ikke lagre push-token:", error.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
