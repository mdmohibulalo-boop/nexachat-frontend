import { useNavigate } from "react-router-dom";

type Props = {
  onLogout?: () => void;
};

export default function Navbar({ onLogout }: Props) {
  const navigate = useNavigate();

  const handleLogout = () => {
    // ✅ socket disconnect callback
    onLogout?.();

    // ✅ clear storage
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // ✅ redirect login
    navigate("/login");
  };

  return (
    <div
      style={{
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        background: "#111",
        color: "#fff",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        position: "sticky",
        top: 0,
        zIndex: 999,
      }}
    >
      {/* ✅ Left Logo */}
      <div
        onClick={() => navigate("/chat")}
        style={{ fontWeight: 700, fontSize: "18px", cursor: "pointer" }}
        title="Go to Chats"
      >
        AmoraLock ❤️🔐
      </div>

      {/* ✅ Right Buttons */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {/* ✅ Profile Section Button */}
        <button
          onClick={() => navigate("/profile")}
          style={{
            background: "transparent",
            color: "white",
            border: "1px solid rgba(255,255,255,0.2)",
            padding: "8px 14px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Profile
        </button>

        {/* ✅ Logout Button */}
        <button
          onClick={handleLogout}
          style={{
            background: "#ff3b3b",
            color: "white",
            border: "none",
            padding: "8px 14px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
