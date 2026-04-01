import { createContext, useContext, ReactNode, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useGetMe, User } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refetchUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  refetchUser: () => {},
});

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function speakWelcome(fullName: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const firstName = fullName.split(" ")[0];
  const saludo = getGreeting();

  const trySpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    // Priority: Peruvian Spanish first, then other Latin American, then any Spanish
    const preferredCodes = ["es-PE", "es-419", "es-MX", "es-CO", "es-AR", "es-CL", "es-US", "es-VE"];
    const voice =
      preferredCodes.reduce<SpeechSynthesisVoice | null>((found, code) =>
        found ?? (voices.find(v => v.lang === code) ?? null), null)
      ?? voices.find(v => v.lang.startsWith("es"))
      ?? null;

    const utterance = new SpeechSynthesisUtterance(
      `¡${saludo}, ${firstName}! ¡Bienvenido al Portal Académico de la Universidad Autónoma de Ica!`
    );
    utterance.lang = "es-PE";
    utterance.rate = 1.05;
    utterance.pitch = 1.3;
    utterance.volume = 1;
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    trySpeak();
  } else {
    window.speechSynthesis.onvoiceschanged = () => { trySpeak(); };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, isError, refetch } = useGetMe({
    query: {
      retry: false,
      refetchOnWindowFocus: false,
    }
  });

  // Greet once per session when user first logs in
  const greeted = useRef(false);
  useEffect(() => {
    if (user && !greeted.current) {
      greeted.current = true;
      // Small delay so browser allows audio after navigation
      setTimeout(() => speakWelcome(user.fullName || user.username), 600);
    }
  }, [user]);

  useEffect(() => {
    if (!isLoading && (isError || !user) && location !== "/login") {
      setLocation("/login");
    } else if (!isLoading && user && location === "/login") {
      setLocation("/");
    }
  }, [isLoading, isError, user, location, setLocation]);

  return (
    <AuthContext.Provider value={{
      user: user || null,
      isLoading,
      isAuthenticated: !!user,
      refetchUser: refetch,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
