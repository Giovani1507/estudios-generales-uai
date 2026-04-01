import { createContext, useContext, ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useGetMe, User } from "@workspace/api-client-react";
import { playWelcome, getGreeting } from "@/lib/audio-unlock";
import { WelcomeCharacter } from "@/components/WelcomeCharacter";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isLoading, isError, refetch } = useGetMe({
    query: {
      retry: false,
      refetchOnWindowFocus: false,
    }
  });

  const [showCharacter, setShowCharacter] = useState(false);
  const [charFirstName, setCharFirstName] = useState("");
  const [charSaludo, setCharSaludo] = useState("");
  const greeted = useRef(false);

  useEffect(() => {
    if (user && !greeted.current) {
      greeted.current = true;
      const firstName = (user.fullName || user.username).split(" ")[0];
      setCharFirstName(firstName);
      setCharSaludo(getGreeting());
      setShowCharacter(true);
      playWelcome(user.fullName || user.username);
    }
    // Reset greeted when user logs out
    if (!user) greeted.current = false;
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
      <WelcomeCharacter
        visible={showCharacter}
        firstName={charFirstName}
        saludo={charSaludo}
        onDone={() => setShowCharacter(false)}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
