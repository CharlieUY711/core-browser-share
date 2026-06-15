"use client";

import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { BrowserSession } from "@/types";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function useSession() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(async (): Promise<string | null> => {
    setLoading(true);
    setError(null);

    const code = generateCode();

    const { error: dbError } = await supabase.from("browser_sessions").insert({
      code,
      active: true,
    });

    setLoading(false);

    if (dbError) {
      setError("No se pudo crear la sesión. Intente de nuevo.");
      return null;
    }

    return code;
  }, []);

  const findSession = useCallback(async (code: string): Promise<BrowserSession | null> => {
    setLoading(true);
    setError(null);

    const { data, error: dbError } = await supabase
      .from("browser_sessions")
      .select("*")
      .eq("code", code)
      .eq("active", true)
      .single<BrowserSession>();

    setLoading(false);

    if (dbError || !data) {
      setError("Código inválido o sesión inactiva.");
      return null;
    }

    return data;
  }, []);

  const closeSession = useCallback(async (code: string): Promise<void> => {
    await supabase.from("browser_sessions").update({ active: false }).eq("code", code);
  }, []);

  return { createSession, findSession, closeSession, loading, error };
}
