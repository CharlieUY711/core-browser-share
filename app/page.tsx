"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";

export default function HomePage() {
  const router = useRouter();
  const { createSession, findSession, loading, error } = useSession();
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleCreate = async () => {
    const sessionCode = await createSession();
    if (sessionCode) {
      router.push(`/session/${sessionCode}?role=host`);
    }
  };

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (trimmed.length !== 6) {
      setJoinError("El código debe tener 6 dígitos.");
      return;
    }

    const session = await findSession(trimmed);
    if (session) {
      router.push(`/session/${trimmed}?role=viewer`);
    } else {
      setJoinError(error || "Sesión no encontrada.");
    }
  };

  return (
    <div className="animate-fade-in flex flex-col items-center gap-10">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-core-text">
          Core Browser Share
        </h1>
        <p className="mt-2 text-sm text-core-text-muted">
          Compartí tu navegador en tiempo real. Sin instalaciones.
        </p>
      </div>

      {/* Create session */}
      <div className="card w-full max-w-sm text-center">
        <h2 className="mb-1 text-sm font-medium text-core-text">Iniciar sesión</h2>
        <p className="mb-5 text-xs text-core-text-muted">
          Generá un código y compartilo con quien quieras
        </p>
        <button onClick={handleCreate} disabled={loading} className="btn-primary w-full">
          {loading ? "Creando..." : "Crear sesión"}
        </button>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </div>

      <div className="flex w-full max-w-sm items-center gap-3">
        <div className="h-px flex-1 bg-core-border" />
        <span className="text-xs text-core-muted">o</span>
        <div className="h-px flex-1 bg-core-border" />
      </div>

      {/* Join session */}
      <div className="card w-full max-w-sm">
        <h2 className="mb-1 text-sm font-medium text-core-text">Unirse a una sesión</h2>
        <p className="mb-5 text-xs text-core-text-muted">Ingresá el código de 6 dígitos</p>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, ""));
            setJoinError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          placeholder="000000"
          className="input-code mb-4"
        />
        <button onClick={handleJoin} disabled={loading || code.length !== 6} className="btn-primary w-full">
          {loading ? "Buscando..." : "Unirse"}
        </button>
        {joinError && <p className="mt-3 text-xs text-red-400">{joinError}</p>}
      </div>
    </div>
  );
}
