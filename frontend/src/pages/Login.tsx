import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BackgroundAnimation } from "../components/BackgroundAnimation";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@velozity.dev");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Invalid email or password.");
    }
  }

  return (
    <>
      <BackgroundAnimation />
      <div className="login-screen">
        <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark" />
          <span className="brand-name" style={{ fontSize: 16 }}>
            Velozity
          </span>
        </div>
        <h2>Sign in</h2>
        <p style={{ color: "var(--text-muted)", marginTop: 0, marginBottom: 20, fontSize: 13 }}>
          Client project dashboard
        </p>
        <form onSubmit={onSubmit} className="login-form">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" />
          <button type="submit" className="primary" style={{ marginTop: 6 }}>
            Sign in
          </button>
          {error && <p className="error-text">{error}</p>}
        </form>
        <p className="login-hint">
          Seeded accounts (password: Password123!)<br />
          admin@velozity.dev · pm1@velozity.dev · pm2@velozity.dev · dev1–4@velozity.dev
        </p>
        </div>
      </div>
    </>
  );
}
