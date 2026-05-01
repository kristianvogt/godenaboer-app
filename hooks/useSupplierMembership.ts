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

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    supabase
      .from("supplier_memberships")
      .select("role, supplier_id, suppliers(name)")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
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
  }, [user]);

  return { ...state, loading };
}
