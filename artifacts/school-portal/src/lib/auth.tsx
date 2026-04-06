import { createContext, useContext, ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey, User } from "@workspace/api-client-react";

const PUBLIC_ROUTES = ["/login", "/registroestudiantesinhorario"];

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
      queryKey: getGetMeQueryKey(),
      retry: false,
      refetchOnWindowFocus: false,
    }
  });

  useEffect(() => {
    if (!isLoading && (isError || !user) && !PUBLIC_ROUTES.includes(location)) {
      setLocation("/login");
    } else if (!isLoading && user && location === "/login") {
      setLocation("/");
    }
  }, [isLoading, isError, user, location]);

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
