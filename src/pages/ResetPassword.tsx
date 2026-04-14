import { useState, useEffect } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const [searchParams] = useSearchParams();

  // 🔥 URL se token auto lena
  useEffect(() => {
    const t = searchParams.get("token");
    if (t) setToken(t);
  }, []);

  const handleReset = async () => {
    try {
      const res = await axios.post(
        "http://localhost:5000/api/auth/reset-password",
        {
          token,
          newPassword: password,
        }
      );

      setMsg(res.data.message);
    } catch (err: any) {
      setMsg(err.response?.data?.message || "Error");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Reset Password</h2>

      {/* ✅ TOKEN HIDDEN (USER KO NAHI DIKHAYENGE) */}

      <input
        type="password"
        placeholder="Enter new password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <br /><br />

      <button onClick={handleReset}>
        Reset Password
      </button>

      <p>{msg}</p>
    </div>
  );
}