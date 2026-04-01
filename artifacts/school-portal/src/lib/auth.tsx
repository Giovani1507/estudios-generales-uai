import { createContext, useContext, ReactNode, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useGetMe, User } from "@workspace/api-client-react";
import { playAudioBuffer } from "@/lib/audio-unlock";

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

async function speakWelcome(fullName: string) {
  const firstName = fullName.split(" ")[0];
  const saludo = getGreeting();
  const text = `¡${saludo}, ${firstName}! ¡Bienvenido al Portal Académico de la Universidad Autónoma de Ica!`;

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: "nova" }),
    });
    if (!res.ok) return;
    const arrayBuffer = await res.arrayBuffer();
    await playAudioBuffer(arrayBuffer);
  } catch (e) {
    console.error("[tts]", e);
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
      speakWelcome(user.fullName || user.username);
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
