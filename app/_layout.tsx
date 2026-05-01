import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useAuth } from "@/hooks/useAuth";
import { useSupplierMembership } from "@/hooks/useSupplierMembership";
import "../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { session, loading } = useAuth();
  const { isSupplierUser, loading: supplierLoading } = useSupplierMembership();
  const segments = useSegments();
  const router = useRouter();

  const isReady = !loading && (!session || !supplierLoading);

  useEffect(() => {
    console.log("[Layout] loading:", loading, "supplierLoading:", supplierLoading, "isReady:", isReady, "session:", !!session, "isSupplierUser:", isSupplierUser);
    if (!isReady) return;
    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === "login";

    if (!session && !inAuthGroup) {
      router.replace("/login");
    } else if (session && inAuthGroup) {
      if (isSupplierUser) {
        router.replace("/(supplier)");
      } else {
        router.replace("/(tabs)");
      }
    }
  }, [session, isReady, segments, isSupplierUser]);

  console.log("[Layout render] loading:", loading, "supplierLoading:", supplierLoading, "isReady:", isReady, "session:", !!session, "isSupplierUser:", isSupplierUser);
  if (!isReady) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Slot />
    </>
  );
}
