import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart, User, Users, Lock, Mail, ArrowRight, Bot, MapPin,
  Shield, CalendarDays, AtSign, Eye, EyeOff, Sparkles,
  ShieldCheck, Brain, Bell, FileText, Menu, X, ChevronDown
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getCurrentUser, isAuthenticated } from "@/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;
const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const NAV_LINKS = ["Features", "How it works", "Security"];

const FEATURES = [
  {
    icon: Brain,
    title: "AI-Powered Insights",
    desc: "Pattern recognition surfaces cognitive changes early, giving caregivers actionable daily summaries before situations escalate.",
    color: "#7c6af7"
  },
  {
    icon: MapPin,
    title: "Location Safety",
    desc: "Geofenced safe zones with real-time alerts the moment a patient ventures outside defined boundaries.",
    color: "#06b6d4"
  },
  {
    icon: Bell,
    title: "Smart Alerts",
    desc: "Context-aware notifications that distinguish routine movement from genuine safety concerns — fewer false alarms.",
    color: "#f59e0b"
  },
  {
    icon: FileText,
    title: "Doctor-Ready Reports",
    desc: "Auto-generated structured reports summarising behavioural trends, ready to share at the next clinical appointment.",
    color: "#10b981"
  },
  {
    icon: Users,
    title: "Multi-Patient Support",
    desc: "Manage multiple patients from a single caregiver dashboard with per-patient privacy controls.",
    color: "#ec4899"
  },
  {
    icon: ShieldCheck,
    title: "Bank-Grade Security",
    desc: "JWT authentication, bcrypt hashing, and strict password policies keep every account protected.",
    color: "#8b5cf6"
  }
];

const HOW_IT_WORKS = [
  { step: "01", title: "Create your account", desc: "Sign up as a caregiver or patient in under two minutes." },
  { step: "02", title: "Connect patient & caregiver", desc: "Link accounts using a unique caregiver ID so both sides stay in sync." },
  { step: "03", title: "Monitor & respond", desc: "The AI watches for patterns; you get alerts and insights in real time." },
];

export default function Index() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    role: "patient", name: "", username: "", dob: "",
    email: "", password: "", confirmPassword: "", caregiverId: ""
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const formRef = useRef(null);
  const blockClipboard = (e) => e.preventDefault();

  useEffect(() => {
    if (!isAuthenticated()) return;
    const user = getCurrentUser();
    const role = String(user?.role || "").toLowerCase();
    if (role === "caregiver") navigate("/caregiver", { replace: true });
    else if (role === "patient") navigate("/patient", { replace: true });
  }, [navigate]);

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth" });

  const getAgeFromDob = (dob) => {
    const date = new Date(`${dob}T00:00:00`);
    if (isNaN(date.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const m = today.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--;
    return age;
  };

  const validateLogin = () => {
    if (!EMAIL_REGEX.test(loginForm.email.trim().toLowerCase())) return "Enter a valid email address";
    if (!loginForm.password) return "Password is required";
    return "";
  };

  const validateRegister = () => {
    const u = registerForm.username.trim().toLowerCase();
    const p = registerForm.password.trim();
    const d = registerForm.dob.trim();
    if (!registerForm.name.trim()) return "Full name is required";
    if (!USERNAME_REGEX.test(u)) return "Username: 3-30 chars, lowercase/numbers/._- only";
    if (!DOB_REGEX.test(d)) return "Date of birth must be YYYY-MM-DD";
    const age = getAgeFromDob(d);
    if (age == null) return "Enter a valid date of birth";
    if (age < 18) return "You must be at least 18";
    if (!EMAIL_REGEX.test(registerForm.email.trim().toLowerCase())) return "Enter a valid email";
    if (!PASSWORD_REGEX.test(p)) return "Password needs upper, lower, number, special char, 8+ chars";
    if (registerForm.confirmPassword !== registerForm.password) return "Passwords must match";
    if (p.toLowerCase() === u) return "Password cannot match username";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const err = authMode === "login" ? validateLogin() : validateRegister();
    if (err) { setError(err); return; }
    setIsSubmitting(true);
    try {
      const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = authMode === "login"
        ? { email: loginForm.email.trim().toLowerCase(), password: loginForm.password }
        : {
            role: registerForm.role,
            name: registerForm.name.trim(),
            username: registerForm.username.trim().toLowerCase(),
            dob: registerForm.dob.trim(),
             email: registerForm.email.trim().toLowerCase(),
            password: registerForm.password,
            caregiverId: registerForm.caregiverId.trim() || undefined
          };
      const data = await apiRequest(path, { method: "POST", body: JSON.stringify(payload) });
      const role = String(data.user?.role || registerForm.role || "patient").toLowerCase();
      const normalizedUser = { ...(data.user || {}), role };
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(normalizedUser));
      navigate(role === "caregiver" ? "/caregiver" : "/patient");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStrength = (pw) => {
    if (!pw) return { label: "Weak", score: 0 };
    const score = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/, /.{12,}/]
      .reduce((a, r) => a + (r.test(pw) ? 1 : 0), 0);
    if (score <= 2) return { label: "Weak", score: 1 };
    if (score <= 4) return { label: "Medium", score: 2 };
    return { label: "Strong", score: 3 };
  };

  const strength = getStrength(registerForm.password);

  const inputClass = "w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#e5e7eb] bg-white text-[#111] text-sm placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#7c6af7]/40 focus:border-[#7c6af7] transition-all";

  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", background: "#fafafa", color: "#111", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,300;0,600;1,300&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        .hero-grad { background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 40%, #ddd6fe 100%); }
        .card-hover { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(124,106,247,0.12); }
        .fade-in { animation: fadeUp 0.7s ease both; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } }
        .stagger-1 { animation-delay: 0.1s; }
        .stagger-2 { animation-delay: 0.2s; }
        .stagger-3 { animation-delay: 0.3s; }
        .pill { display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:999px; font-size:12px; font-weight:500; background:#f0eeff; color:#7c6af7; border:1px solid #e0d9ff; }
        .btn-primary { background:#111; color:#fff; border:none; border-radius:10px; padding:12px 24px; font-size:14px; font-weight:500; cursor:pointer; display:inline-flex; align-items:center; gap:8px; transition:background 0.2s, transform 0.15s; font-family:inherit; }
        .btn-primary:hover { background:#333; transform:translateY(-1px); }
        .btn-primary:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
        .btn-outline { background:transparent; color:#111; border:1.5px solid #e5e7eb; border-radius:10px; padding:11px 22px; font-size:14px; font-weight:500; cursor:pointer; display:inline-flex; align-items:center; gap:8px; transition:all 0.2s; font-family:inherit; }
        .btn-outline:hover { border-color:#7c6af7; color:#7c6af7; }
        .tab-active { background:#7c6af7; color:#fff; border-radius:8px; box-shadow: 0 2px 8px rgba(124,106,247,0.35); }
        .tab-btn { flex:1; padding:10px; border:none; background:transparent; font-size:13px; font-weight:500; cursor:pointer; border-radius:8px; transition:all 0.2s; font-family:inherit; color:#6b7280; }
        .tab-btn:hover:not(.tab-active) { background:#e5e7eb; color:#111; }
        .role-active { background:#7c6af7; color:#fff; border-radius:8px; box-shadow: 0 2px 8px rgba(124,106,247,0.35); }
        .role-btn { flex:1; padding:9px; border:none; background:transparent; font-size:13px; font-weight:500; cursor:pointer; border-radius:8px; transition:all 0.2s; font-family:inherit; color:#6b7280; display:flex; align-items:center; justify-content:center; gap:6px; }
        .role-btn:hover:not(.role-active) { background:#ede9fe; color:#7c6af7; }
        .step-line::after { content:''; position:absolute; left:20px; top:44px; bottom:-20px; width:1px; background:linear-gradient(to bottom, #e5e7eb, transparent); }
        ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:3px; }
      `}</style>

      {/* NAVBAR */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(250,250,250,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Heart size={15} color="#fff" fill="#fff" />
            </div>
            <span style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, letterSpacing: "-0.3px" }}>reminiscence.ai</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 32 }} className="desktop-nav">
            {NAV_LINKS.map(link => (
              <a key={link} href={`#${link.toLowerCase().replace(/ /g, "-")}`}
                style={{ fontSize: 14, color: "#555", textDecoration: "none", fontWeight: 500, transition: "color 0.2s" }}
                onMouseEnter={e => e.target.style.color = "#111"}
                onMouseLeave={e => e.target.style.color = "#555"}>
                {link}
              </a>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn-outline" style={{ padding: "8px 18px", fontSize: 13 }} onClick={scrollToForm}>Sign in</button>
            <button className="btn-primary" style={{ padding: "8px 18px", fontSize: 13 }} onClick={() => { setAuthMode("register"); scrollToForm(); }}>Get started</button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero-grad" style={{ padding: "80px 24px 100px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 440px", gap: 60, alignItems: "center" }}>

          {/* Left: Hero copy */}
          <div className="fade-in">
            <div className="pill" style={{ marginBottom: 24 }}>
              <Sparkles size={12} /> AI-powered dementia care
            </div>
            <h1 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(40px, 5vw, 62px)", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-1px", marginBottom: 20 }}>
              Care that never<br />
              <em style={{ fontStyle: "italic", fontWeight: 300, color: "#7c6af7" }}>forgets</em>
            </h1>
            <p style={{ fontSize: 17, color: "#555", lineHeight: 1.7, maxWidth: 480, marginBottom: 36 }}>
              reminiscence.ai connects patients and caregivers through intelligent monitoring, real-time safety alerts, and AI-generated insights — so nothing falls through the cracks.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button className="btn-primary" onClick={() => { setAuthMode("register"); scrollToForm(); }}>
                Start for free <ArrowRight size={16} />
              </button>
              <button className="btn-outline" onClick={scrollToForm}>
                Sign in
              </button>
            </div>
            <p style={{ marginTop: 20, fontSize: 12, color: "#9ca3af" }}>No credit card required · HIPAA-aware design · Free to start</p>
          </div>

          {/* Right: Auth form */}
          <div ref={formRef} className="fade-in stagger-2" style={{ background: "#fff", borderRadius: 20, border: "1px solid #e5e7eb", padding: 32, boxShadow: "0 8px 40px rgba(0,0,0,0.07)" }}>
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 24, fontWeight: 600, marginBottom: 4, letterSpacing: "-0.3px" }}>
              {authMode === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
              {authMode === "login" ? "Sign in to your account to continue." : "Join reminiscence.ai today."}
            </p>

            {/* Auth mode tabs */}
            <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 14 }}>
              {["login", "register"].map(mode => (
                <button key={mode} className={`tab-btn ${authMode === mode ? "tab-active" : ""}`}
                  onClick={() => { setAuthMode(mode); setError(""); }}>
                  {mode === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            {/* Role tabs */}
            <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 20 }}>
              {[["patient", User], ["caregiver", Users]].map(([role, Icon]) => (
                <button key={role} className={`role-btn ${registerForm.role === role ? "role-active" : ""}`}
                  onClick={() => setRegisterForm(p => ({ ...p, role }))}>
                  <Icon size={14} /> {role.charAt(0).toUpperCase() + role.slice(1)}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {authMode === "register" && (
                <>
                  {/* Full name */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Full Name</label>
                    <div style={{ position: "relative" }}>
                      <User size={15} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                      <input className={inputClass} type="text" placeholder="Jane Doe" value={registerForm.name}
                        onChange={e => setRegisterForm(p => ({ ...p, name: e.target.value }))} />
                    </div>
                  </div>
                  {/* Username */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Username</label>
                    <div style={{ position: "relative" }}>
                      <AtSign size={15} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                      <input className={inputClass} type="text" placeholder="jane.doe" value={registerForm.username}
                        onChange={e => setRegisterForm(p => ({ ...p, username: e.target.value }))} />
                    </div>
                  </div>
                  {/* DOB */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Date of Birth</label>
                    <div style={{ position: "relative" }}>
                      <CalendarDays size={15} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                      <input className={inputClass} type="date" value={registerForm.dob}
                        onChange={e => setRegisterForm(p => ({ ...p, dob: e.target.value }))} />
                    </div>
                  </div>
                  {registerForm.role === "patient" && (
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Caregiver ID <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span></label>
                      <div style={{ position: "relative" }}>
                        <Shield size={15} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                        <input className={inputClass} type="text" placeholder="Your caregiver's ID" value={registerForm.caregiverId}
                          onChange={e => setRegisterForm(p => ({ ...p, caregiverId: e.target.value }))} />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Email */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Email</label>
                <div style={{ position: "relative" }}>
                  <Mail size={15} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input className={inputClass} type="email" placeholder="your@email.com"
                    value={authMode === "login" ? loginForm.email : registerForm.email}
                    onChange={e => authMode === "login"
                      ? setLoginForm(p => ({ ...p, email: e.target.value }))
                      : setRegisterForm(p => ({ ...p, email: e.target.value }))} />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Password</label>
                <div style={{ position: "relative" }}>
                  <Lock size={15} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input className={inputClass} style={{ paddingRight: 40 }}
                    type={showPassword ? "text" : "password"} placeholder="••••••••"
                    value={authMode === "login" ? loginForm.password : registerForm.password}
                    onCopy={blockClipboard} onCut={blockClipboard} onPaste={blockClipboard}
                    onChange={e => authMode === "login"
                      ? setLoginForm(p => ({ ...p, password: e.target.value }))
                      : setRegisterForm(p => ({ ...p, password: e.target.value }))} />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {authMode === "register" && (
                <>
                  {/* Confirm password */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Confirm Password</label>
                    <div style={{ position: "relative" }}>
                      <Lock size={15} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                      <input className={inputClass} style={{ paddingRight: 40 }}
                        type={showConfirmPassword ? "text" : "password"} placeholder="••••••••"
                        value={registerForm.confirmPassword}
                        onCopy={blockClipboard} onCut={blockClipboard} onPaste={blockClipboard}
                        onChange={e => setRegisterForm(p => ({ ...p, confirmPassword: e.target.value }))} />
                      <button type="button" onClick={() => setShowConfirmPassword(p => !p)}
                        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Strength meter */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
                      <span style={{ color: "#6b7280" }}>Password strength</span>
                      <span style={{ color: strength.label === "Strong" ? "#10b981" : strength.label === "Medium" ? "#f59e0b" : "#ef4444", fontWeight: 500 }}>
                        {strength.label}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                      {[1, 2, 3].map(n => (
                        <div key={n} style={{ height: 3, borderRadius: 2, background: strength.score >= n ? (n === 1 ? "#ef4444" : n === 2 ? "#f59e0b" : "#10b981") : "#e5e7eb", transition: "background 0.3s" }} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
                {isSubmitting ? "Please wait..." : authMode === "login" ? "Sign In" : `Create ${registerForm.role} account`}
                <ArrowRight size={16} />
              </button>
            </form>

            <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 16 }}>
              <a href="#" style={{ color: "#7c6af7", textDecoration: "none" }}>Forgot password?</a>
              {" · "}
              <a href="#" style={{ color: "#9ca3af", textDecoration: "none" }}>Terms</a>
              {" · "}
              <a href="#" style={{ color: "#9ca3af", textDecoration: "none" }}>Privacy</a>
            </p>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{ textAlign: "center", marginTop: 60 }}>
          <a href="#features" style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8, color: "#9ca3af", textDecoration: "none", fontSize: 12 }}>
            <span>Explore features</span>
            <ChevronDown size={18} style={{ animation: "fadeUp 1s ease infinite alternate" }} />
          </a>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: "100px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div className="pill" style={{ marginBottom: 16, display: "inline-flex" }}>Features</div>
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 600, letterSpacing: "-0.5px", marginBottom: 16 }}>
              Everything you need, nothing you don't
            </h2>
            <p style={{ fontSize: 16, color: "#6b7280", maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
              Built specifically for dementia care — every feature exists to reduce caregiver burden and improve patient safety.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
            {FEATURES.map(({ icon: Icon, title, desc, color }, i) => (
              <div key={i} className="card-hover" style={{ padding: 28, border: "1px solid #f0f0f0", borderRadius: 16, background: "#fafafa" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Icon size={20} color={color} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, letterSpacing: "-0.2px" }}>{title}</h3>
                <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ padding: "100px 24px", background: "#fafafa" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div className="pill" style={{ marginBottom: 16, display: "inline-flex" }}>How it works</div>
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 600, letterSpacing: "-0.5px" }}>
              Up and running in minutes
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {HOW_IT_WORKS.map(({ step, title, desc }, i) => (
              <div key={i} style={{ display: "flex", gap: 24, position: "relative", paddingBottom: i < HOW_IT_WORKS.length - 1 ? 40 : 0 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "#111", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, fontFamily: "monospace", zIndex: 1 }}>
                    {step}
                  </div>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div style={{ width: 1, flex: 1, background: "linear-gradient(to bottom, #e5e7eb, transparent)", marginTop: 8 }} />
                  )}
                </div>
                <div style={{ paddingTop: 8 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, letterSpacing: "-0.2px" }}>{title}</h3>
                  <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.65 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" style={{ padding: "100px 24px", background: "#111", color: "#fff" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 500, background: "rgba(124,106,247,0.15)", color: "#a78bfa", border: "1px solid rgba(124,106,247,0.2)", marginBottom: 24 }}>
            <ShieldCheck size={12} /> Security
          </div>
          <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 600, letterSpacing: "-0.5px", marginBottom: 20 }}>
            Security you can trust
          </h2>
          <p style={{ fontSize: 16, color: "#9ca3af", maxWidth: 560, margin: "0 auto 56px", lineHeight: 1.7 }}>
            Patient data is sensitive. We treat it that way — with industry-standard security baked in from day one.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 1, background: "#222", borderRadius: 16, overflow: "hidden", border: "1px solid #333" }}>
            {[
              ["JWT Auth", "Stateless tokens, 7-day expiry"],
              ["bcrypt Hashing", "Passwords never stored in plain text"],
              ["Strong Policy", "Enforced complexity at signup"],
              ["CORS Protected", "Origin-restricted API endpoints"],
            ].map(([title, desc], i) => (
              <div key={i} style={{ padding: 28, background: "#111", textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#fff" }}>{title}</div>
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "100px 24px", background: "#fff", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 600, letterSpacing: "-0.5px", marginBottom: 16 }}>
            Ready to get started?
          </h2>
          <p style={{ fontSize: 16, color: "#6b7280", marginBottom: 36, lineHeight: 1.7 }}>
            Join caregivers and patients already using reminiscence.ai to stay safe, connected, and informed.
          </p>
          <button className="btn-primary" style={{ fontSize: 15, padding: "14px 32px" }}
            onClick={() => { setAuthMode("register"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            Create your free account <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #f0f0f0", padding: "32px 24px", background: "#fafafa" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Heart size={12} color="#fff" fill="#fff" />
            </div>
            <span style={{ fontFamily: "Fraunces, serif", fontSize: 14, fontWeight: 600 }}>reminiscence.ai</span>
          </div>
          <p style={{ fontSize: 12, color: "#9ca3af" }}>© 2025 reminiscence.ai · Built with care</p>
          <div style={{ display: "flex", gap: 20 }}>
            {["Terms", "Privacy", "Contact"].map(link => (
              <a key={link} href="#" style={{ fontSize: 12, color: "#9ca3af", textDecoration: "none" }}>{link}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}