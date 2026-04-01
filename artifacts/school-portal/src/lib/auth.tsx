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

function speakWelcome(fullName: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const firstName = fullName.split(" ")[0];

  const trySpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    // Priority: Latin American Spanish locales, then any Spanish voice
    const latinAmCodes = ["es-419", "es-MX", "es-US", "es-CO", "es-AR", "es-CL", "es-PE", "es-VE"];
    let voice =
      latinAmCodes.reduce<SpeechSynthesisVoice | null>((found, code) =>
        found ?? (voices.find(v => v.lang === code) ?? null), null)
      ?? voices.find(v => v.lang.startsWith("es"))
      ?? voices[0];

    const utterance = new SpeechSynthesisUtterance(
      `¡Bienvenido, ${firstName}! ¡Qué bueno verte por aquí! Portal Académico, Universidad Autónoma de Ica.`
    );
    utterance.lang = "es-419";
    utterance.rate = 1.08;
    utterance.pitch = 1.35;
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
