import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

interface SupplierMembership {
  isSupplierUser: boolean;
  supplierId: string | null;
  supplierName: string | null;
  role: string | null;
  loading: boolean;
}

export function useSupplierMembership(): SupplierMembership {
  const { user } = useAuth();
  const [state, setState] = useState<Omit<SupplierMembership, "loading">>({
    isSupplierUser: false,
    supplierId: null,
    supplierName: null,
    role: null,
  });
  const [loading, setLoading] = useState(true);

  const userId = user?.id;

  useEffect(() => {
    let isMounted = true;

    if (!userId) {
      console.log("[SupplierMembership] no user, skipping fetch");
      setLoading(false);
      return;
    }

    console.log("[SupplierMembership] fetching for user:", userId);
    supabase
      .from("supplier_memberships")
      .select("role, supplier_id, suppliers(name)")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!isMounted) return;
        console.log("[SupplierMembership] result:", JSON.stringify(data));
        if (data) {
          setState({
            isSupplierUser: true,
            supplierId: data.supplier_id,
            supplierName: (data.suppliers as any)?.name ?? null,
            role: data.role,
          });
        }
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  return { ...state, loading };
}
