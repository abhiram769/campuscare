
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import api from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check existing login when application starts
  useEffect(() => {
    const verifyUser = async () => {
      const token = localStorage.getItem("campuscare_token");

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");
        setUser(response.data.user);
      } catch (error) {
        localStorage.removeItem("campuscare_token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, []);

  // Login
  const login = async (identifier, password) => {
    const response = await api.post("/auth/login", {
      identifier,
      password,
    });

    localStorage.setItem(
      "campuscare_token",
      response.data.token
    );

    setUser(response.data.user);

    return response.data.user;
  };

  // Registration
  const register = async (userData) => {
    const response = await api.post(
      "/auth/register",
      userData
    );

    localStorage.setItem(
      "campuscare_token",
      response.data.token
    );

    setUser(response.data.user);

    return response.data.user;
  };

  // Logout
  const logout = () => {
    localStorage.removeItem("campuscare_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
