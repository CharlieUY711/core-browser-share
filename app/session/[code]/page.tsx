"use client";

import { useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Host } from "@/components/Host";
import { Viewer } from "@/components/Viewer";
import { useSession } from "@/hooks/useSession";

interface SessionPageProps {
  params: Promise<{ code: string }>;
}

export default function SessionPage({ params }: SessionPageProps) {
  const { code } = use(params);
  const searchParams = useSearchParams();
  const role = searchParams.get("role") as "host" | "viewer" | null;

  const { findSession, loading } = useSession();
  const [valid, setValid] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    findSession(code).then((session) => setValid(!!session));
  }, [code, findSession]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || valid === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-core-muted border-t-core-accent" />
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="card text-center">
        <p className="mb-4 text-sm text-core-text-muted">Sesión no encontrada o inactiva.</p>
        <Link href="/" className="btn-ghost">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      {/* Session header */}
      <div className="card flex flex-col items-center gap-2 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="mb-1 text-xs text-core-text-muted">
            {role === "host" ? "Tu código de sesión" : "Sesión activa"}
          </p>
          <div className="session-code">{code}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCopy} className="btn-ghost text-xs">
            {copied ? "¡Copiado!" : "Copiar código"}
          </button>
          <Link href="/" className="btn-ghost text-xs">
            Salir
          </Link>
        </div>
      </div>

      {role === "host" ? (
        <Host sessionCode={code} />
      ) : role === "viewer" ? (
        <Viewer sessionCode={code} />
      ) : (
        <div className="card text-center text-sm text-core-text-muted">
          Rol no reconocido.{" "}
          <Link href="/" className="text-core-accent underline">
            Volver al inicio
          </Link>
        </div>
      )}
    </div>
  );
}
