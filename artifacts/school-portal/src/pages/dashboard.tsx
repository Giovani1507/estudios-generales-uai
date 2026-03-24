import { useAuth } from "@/lib/auth";

const ROLE_LABELS: Record<string, string> = {
  administrador: "Administrador",
  coordinador: "Coordinador",
  administrativo: "Administrativo",
};

export default function Dashboard() {
  const { user } = useAuth();
  const roleLabel = user?.role ? ROLE_LABELS[user.role] ?? user.role : "";

  return (
    <div className="relative flex flex-col items-center justify-center min-h-full overflow-hidden"
      style={{
        background: "linear-gradient(145deg, #1a3a6b 0%, #2f5aa6 40%, #4a7fcb 70%, #d6e6f8 100%)",
        minHeight: "calc(100vh - 60px)",
      }}
    >
      {/* Watermark escudo */}
      <img
        src={`${import.meta.env.BASE_URL}escudo.png`}
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute"
        style={{
          width: "min(520px, 75vw)",
          opacity: 0.08,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          filter: "brightness(0) invert(1)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-8 py-16 gap-6">
        {/* Logo + nombre */}
        <img
          src={`${import.meta.env.BASE_URL}escudo.png`}
          alt="Universidad Autónoma de Ica"
          className="object-contain drop-shadow-lg"
          style={{ width: "110px" }}
        />

        <div className="flex flex-col gap-1">
          <h1 className="text-white font-bold tracking-wide drop-shadow"
            style={{ fontSize: "clamp(1.4rem, 3vw, 2rem)" }}>
            Universidad Autónoma de Ica
          </h1>
          <p className="text-blue-100 font-medium tracking-widest uppercase text-sm">
            Estudios Generales · 2026‑1
          </p>
        </div>

        {/* Divider */}
        <div className="w-24 h-px bg-white/40 rounded-full" />

        {/* Bienvenida */}
        <div className="flex flex-col gap-1">
          <p className="text-blue-200 text-base font-medium">Bienvenido de vuelta</p>
          <p className="text-white font-bold drop-shadow"
            style={{ fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)" }}>
            {user?.name ?? user?.username ?? "Usuario"}
          </p>
          {roleLabel && (
            <span className="mt-1 inline-block px-4 py-1 rounded-full text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.18)", color: "#fff", backdropFilter: "blur(4px)" }}>
              {roleLabel}
            </span>
          )}
        </div>

        {/* Año académico pill */}
        <div className="mt-4 px-6 py-2 rounded-full border border-white/30 text-white/80 text-sm"
          style={{ backdropFilter: "blur(6px)", background: "rgba(255,255,255,0.10)" }}>
          Portal Académico — Sistema de acceso restringido
        </div>
      </div>
    </div>
  );
}
