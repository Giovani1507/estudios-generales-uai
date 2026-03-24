export default function Dashboard() {
  return (
    <div
      className="flex items-center justify-center bg-white"
      style={{ minHeight: "calc(100vh - 60px)" }}
    >
      <img
        src={`${import.meta.env.BASE_URL}escudo.png`}
        alt="Universidad Autónoma de Ica"
        className="object-contain"
        style={{ width: "min(420px, 75vw)" }}
      />
    </div>
  );
}
