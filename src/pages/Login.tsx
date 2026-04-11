import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");

  // ✅ message + type
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  // ✅ show/hide password
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setMessage("");
    setIsError(false);

    try {
      const res = await axios.post("https://mahi-0iap.onrender.com/api/auth/login", {
        emailOrUsername,
        password,
      });

      // ✅✅✅ MOST IMPORTANT
      sessionStorage.setItem("token", res.data.token); // ✅ ADDED
      sessionStorage.setItem("user", JSON.stringify(res.data.user));

      console.log("USER STORED IN SESSION:", res.data.user);
      console.log("TOKEN STORED IN SESSION:", res.data.token);

      setMessage("Login Success 🎉");
      setIsError(false);

      // ✅ better redirect
      navigate("/chat");
    } catch (err: any) {
      console.log("LOGIN ERROR:", err?.response?.data);

      // ✅ wrong password / wrong user message
      setMessage(err?.response?.data?.message || "Login Failed ❌");
      setIsError(true);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "100px", color: "white" }}>
      <h1>Login</h1>

      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="Enter Email or Username"
          value={emailOrUsername}
          onChange={(e) => setEmailOrUsername(e.target.value)}
          style={{ padding: "8px", width: "250px" }}
        />
        <br />
        <br />

        {/* ✅ Password + show/hide */}
        <div
          style={{
            width: "250px",
            margin: "0 auto",
            position: "relative",
          }}
        >
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Enter Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: "8px",
              width: "100%",
              paddingRight: "70px",
            }}
          />

          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            style={{
              position: "absolute",
              right: 5,
              top: 5,
              padding: "6px 10px",
              fontSize: 12,
              cursor: "pointer",
              border: "none",
              borderRadius: 6,
              background: "#333",
              color: "white",
            }}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        <br />
        <br />

        <button type="submit" style={{ padding: "10px 25px" }}>
          Login
        </button>
      </form>

      {/* ✅ Message color */}
      {message && (
        <p style={{ marginTop: "20px", color: isError ? "red" : "lightgreen" }}>
          {message}
        </p>
      )}

      {/* ✅✅✅ Signup option added */}
      <p style={{ marginTop: "20px", color: "#ddd", fontSize: 14 }}>
        Don’t have an account?{" "}
        <span
          onClick={() => navigate("/signup")}
          style={{
            color: "#00aaff",
            cursor: "pointer",
            fontWeight: "bold",
            textDecoration: "underline",
          }}
        >
          Sign up
        </span>
      </p>
    </div>
  );
}
