import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import LobbyPage from "./pages/LobbyPage.jsx";
import WaitingPage from "./pages/WaitingPage.jsx";
import GamePage from "./pages/GamePage.jsx";

function Gate({ guest, children }) {
  const { user } = useAuth();
  if (guest && user) return <Navigate to="/lobby" replace />;
  if (!guest && !user) return <Navigate to="/auth" replace />;
  return children;
}

const ROUTES = [
  { path: "/auth", element: <AuthPage />, guest: true },
  { path: "/lobby", element: <LobbyPage /> },
  { path: "/room/:roomId/waiting", element: <WaitingPage /> },
  { path: "/room/:roomId/play", element: <GamePage /> },
];

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Routes>
          {ROUTES.map(({ path, element, guest }) => (
            <Route
              key={path}
              path={path}
              element={<Gate guest={guest}>{element}</Gate>}
            />
          ))}
          <Route path="*" element={<Navigate to="/lobby" replace />} />
        </Routes>
      </SocketProvider>
    </AuthProvider>
  );
}
