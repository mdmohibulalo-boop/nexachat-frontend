import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

export default function Signup() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await axios.post("https://mahi-0iap.onrender.com/api/auth/signup", {
        name,
        username,
        email,
        password,
      });

      setMessage(res.data.message);
      sessionStorage.setItem("user", JSON.stringify(res.data.user));
      window.location.href = "/chat";
    } catch (err: any) {
      setMessage(err?.response?.data?.message || "Signup Failed");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create Account</h1>

        <form onSubmit={handleSignup}>
          <input
            type="text"
            placeholder="Enter Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            type="text"
            placeholder="Enter Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type="email"
            placeholder="Enter Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Enter Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit">Signup</button>
        </form>

        {message && (
          <p style={{ marginTop: "12px", color: "var(--success)" }}>
            {message}
          </p>
        )}

        <p style={{ marginTop: "16px", fontSize: "14px" }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}