import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import LobbyPage from "./pages/LobbyPage.jsx";
import WaitingPage from "./pages/WaitingPage.jsx";
import GamePage from "./pages/GamePage.jsx";

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/lobby" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/auth"
        element={
          <GuestOnly>
            <AuthPage />
          </GuestOnly>
        }
      />
      <Route
        path="/lobby"
        element={
          <RequireAuth>
            <LobbyPage />
          </RequireAuth>
        }
      />
      <Route
        path="/room/:roomId/waiting"
        element={
          <RequireAuth>
            <WaitingPage />
          </RequireAuth>
        }
      />
      <Route
        path="/room/:roomId/play"
        element={
          <RequireAuth>
            <GamePage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/lobby" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppRoutes />
      </SocketProvider>
    </AuthProvider>
  );
}
