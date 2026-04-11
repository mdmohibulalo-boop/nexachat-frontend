import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";

import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";

import Splash from "./components/Splash";

function App() {
  // 🔹 Splash loading state
  const [loading, setLoading] = useState(true);

  // 🔹 Splash timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000); // 2 seconds

    return () => clearTimeout(timer);
  }, []);

  // 🔹 Show Splash first
  if (loading) {
    return <Splash />;
  }

  // 🔹 Normal App Routes
  return (
    <>
      <Routes>
        <Route path="/" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />

        {/* ✅ only ONE user profile route */}
        <Route path="/user/:id" element={<PublicProfile />} />

        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

export default App;