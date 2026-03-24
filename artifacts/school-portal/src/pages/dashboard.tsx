export default function Dashboard() {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        minHeight: "calc(100vh - 60px)",
        backgroundImage: `url(${import.meta.env.BASE_URL}dashboard-bg.png)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <img
        src={`${import.meta.env.BASE_URL}escudo.png`}
        alt="Universidad Autónoma de Ica"
        className="object-contain"
        style={{
          width: "min(380px, 65vw)",
          imageRendering: "crisp-edges",
          filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.18))",
        }}
      />
    </div>
  );
}
