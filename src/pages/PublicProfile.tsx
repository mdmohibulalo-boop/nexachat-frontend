import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";

type UserProfile = {
  id: string;
  name: string;
  username: string;
  about: string;
  profilePic: string;
  isOnline: boolean;
  lastSeen?: string | null;
};

export default function PublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const formatLastSeen = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    const diffHr = Math.floor(diffMin / 60);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    if (!id) return;

    setLoading(true);

    axios
      .get(`https://mahi-0iap.onrender.com/api/user/${id}`)
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div style={{ padding: 20, maxWidth: 520, margin: "0 auto" }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          cursor: "pointer",
          border: "1px solid #ccc",
          background: "white",
          marginBottom: 14,
          fontWeight: 700,
        }}
      >
        ⬅ Back
      </button>

      {loading && <p>Loading...</p>}

      {!loading && !user && <p>User not found ❌</p>}

      {!loading && user && (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 16,
            padding: 16,
            background: "white",
          }}
        >
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div
              style={{
                width: 92,
                height: 92,
                borderRadius: "50%",
                background: "#eee",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {user.profilePic ? (
                <img
                  src={user.profilePic}
                  alt="dp"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: 40 }}>👤</span>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{user.name}</div>
              <div style={{ fontSize: 13, color: "gray", marginTop: 2 }}>
                @{user.username}
              </div>

              <div style={{ marginTop: 8, fontSize: 12, color: "gray" }}>
                {user.isOnline
                  ? "Online"
                  : user.lastSeen
                  ? `Active ${formatLastSeen(user.lastSeen)}`
                  : ""}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, fontSize: 13, color: "#333" }}>
            {user.about ? user.about : "No bio"}
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 12,
              background: "#f5faff",
              border: "1px solid #d8ecff",
              fontSize: 13,
              color: "#333",
            }}
          >
            ✅ This is a public profile (view only). You cannot edit other user's
            profile.
          </div>
        </div>
      )}
    </div>
  );
}
