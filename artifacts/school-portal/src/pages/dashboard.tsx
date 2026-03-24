export default function Dashboard() {
  return (
    <div className="flex flex-col items-center justify-center min-h-full bg-white gap-6"
      style={{ minHeight: "calc(100vh - 60px)" }}>
      <img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="Universidad Autónoma de Ica"
        className="object-contain"
        style={{ width: "min(320px, 70vw)", mixBlendMode: "multiply" }}
      />
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="font-bold tracking-widest uppercase"
          style={{ fontSize: "clamp(1.1rem, 2.5vw, 1.6rem)", color: "#2f5aa6" }}>
          Bienvenido
        </h1>
        <p className="font-semibold tracking-wider uppercase text-gray-600"
          style={{ fontSize: "clamp(0.85rem, 1.8vw, 1.1rem)" }}>
          Estudios Generales
        </p>
      </div>
    </div>
  );
}
