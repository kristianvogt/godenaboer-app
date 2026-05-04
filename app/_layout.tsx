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

  const isReady = !loading;

  useEffect(() => {
    if (!isReady) return;
    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === "login";
    const inSupplierGroup = segments[0] === "(supplier)";
    const inTabsGroup = segments[0] === "(tabs)";

    if (!session && !inAuthGroup) {
      router.replace("/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    } else if (session && !inTabsGroup && !inSupplierGroup) {
      router.replace("/(tabs)");
    } else if (session && inSupplierGroup && !supplierLoading && !isSupplierUser) {
      router.replace("/(tabs)");
    }
  }, [session, isReady, segments, supplierLoading, isSupplierUser]);

  useEffect(() => {
    if (!isReady || !session || supplierLoading) return;

    const inAuthGroup = segments[0] === "login";

    if (inAuthGroup && isSupplierUser) {
      router.replace("/(supplier)");
    }
  }, [isReady, session, isSupplierUser, supplierLoading, segments]);

  if (!isReady) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Slot />
    </>
  );
}
