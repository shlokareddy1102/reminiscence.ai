import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, User, Users, Lock, Mail, ArrowRight, Bot, MapPin, Shield, CalendarDays, AtSign, Eye, EyeOff, Sparkles, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getCurrentUser, isAuthenticated } from "@/lib/auth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;
const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const Index = () => {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    role: "patient",
    name: "",
    username: "",
    dob: "",
    email: "",
    password: "",
    confirmPassword: "",
    caregiverId: ""
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const blockClipboardAction = (e) => e.preventDefault();

  const getAgeFromDob = (dob) => {
    const date = new Date(`${dob}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    const dayDiff = today.getDate() - date.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age -= 1;
    }

    return age;
  };

  useEffect(() => {
    if (!isAuthenticated()) return;

    const user = getCurrentUser();
    const role = String(user?.role || "").toLowerCase();

    if (role === "caregiver") {
      navigate("/caregiver", { replace: true });
      return;
    }

    if (role === "patient") {
      navigate("/patient", { replace: true });
    }
  }, [navigate]);

  const routeByRole = (role) => {
    if (role === "caregiver") {
      navigate("/caregiver");
      return;
    }
    navigate("/patient");
  };

  const validateLogin = () => {
    if (!EMAIL_REGEX.test(loginForm.email.trim().toLowerCase())) {
      return "Enter a valid email address";
    }

    if (!loginForm.password) {
      return "Password is required";
    }

    return "";
  };

  const validateRegister = () => {
    const normalizedUsername = registerForm.username.trim().toLowerCase();
    const normalizedPassword = registerForm.password.trim();
    const normalizedDob = registerForm.dob.trim();

    if (!registerForm.name.trim()) {
      return "Full name is required";
    }

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      return "Username must be 3-30 chars, lowercase letters/numbers/._- only";
    }

    if (!DOB_REGEX.test(normalizedDob)) {
      return "Date of birth must be in YYYY-MM-DD format";
    }

    const age = getAgeFromDob(normalizedDob);
    if (age == null) {
      return "Enter a valid date of birth";
    }

    if (age < 18) {
      return "You must be at least 18 years old to create an account";
    }

    if (!EMAIL_REGEX.test(registerForm.email.trim().toLowerCase())) {
      return "Enter a valid email address";
    }

    if (!PASSWORD_REGEX.test(normalizedPassword)) {
      return "Password must include upper, lower, number, special character and be 8+ chars";
    }

    if (registerForm.confirmPassword !== registerForm.password) {
      return "Password and confirm password must match";
    }

    if (normalizedPassword.toLowerCase() === normalizedUsername) {
      return "Password cannot match username";
    }

    if (normalizedPassword === normalizedDob || normalizedPassword === normalizedDob.replace(/-/g, "")) {
      return "Password cannot match date of birth";
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const validationError = authMode === "login" ? validateLogin() : validateRegister();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        authMode === "login"
          ? {
              email: loginForm.email.trim().toLowerCase(),
              password: loginForm.password
            }
          : {
              role: registerForm.role,
              name: registerForm.name.trim(),
              username: registerForm.username.trim().toLowerCase(),
              dob: registerForm.dob.trim(),
              email: registerForm.email.trim().toLowerCase(),
              password: registerForm.password,
              caregiverId: registerForm.caregiverId.trim() || undefined
            };

      const data = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const role = String(data.user?.role || registerForm.role || "patient").toLowerCase();
      const normalizedUser = { ...(data.user || {}), role };

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(normalizedUser));
      routeByRole(role);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStrength = (password) => {
    if (!password) return { label: "Weak", score: 0 };
    const score = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/, /.{12,}/].reduce((acc, regex) => acc + (regex.test(password) ? 1 : 0), 0);
    if (score <= 2) return { label: "Weak", score: 1 };
    if (score <= 4) return { label: "Medium", score: 2 };
    return { label: "Strong", score: 3 };
  };

  const strength = getStrength(registerForm.password);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background p-4 sm:p-6 lg:p-8">
      <div className="relative max-w-7xl mx-auto rounded-3xl border border-border overflow-hidden shadow-calm bg-card lg:min-h-[84vh]">
        <div className="absolute inset-0 bg-dots pointer-events-none" />
        <div className="grid lg:grid-cols-2 relative z-10 min-h-[84vh]">
          <section className="relative p-6 sm:p-8 lg:p-10 bg-gradient-animated text-foreground border-b lg:border-b-0 lg:border-r border-border">
            <div className="absolute -left-10 top-16 w-44 h-44 blob float" style={{ background: "hsl(var(--primary) / 0.45)" }} />
            <div className="absolute right-4 bottom-8 w-56 h-56 blob float" style={{ background: "hsl(var(--accent) / 0.42)", animationDelay: "1.2s" }} />
            <div className="absolute inset-0 bg-grid opacity-45" />

            <div className="relative h-full flex flex-col justify-between gap-8">
              <div>
                <div className="w-16 h-16 rounded-2xl bg-card/90 flex items-center justify-center shadow-gentle mb-5 glow-pulse">
                  <Heart className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-4xl sm:text-5xl font-display leading-tight text-foreground">
                  reminiscence.ai
                </h1>
                <p className="text-sm sm:text-base text-foreground/80 mt-3 max-w-md leading-relaxed">
                  Assistive AI for dementia support, helping caregivers and patients stay connected, safer, and informed.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 stagger-in">
                <div className="glass rounded-2xl p-4 hover-lift">
                  <Bot className="w-5 h-5 text-primary mb-2" />
                  <p className="text-sm font-semibold">AI Monitoring</p>
                  <p className="text-xs text-muted-foreground">Pattern-based risk summaries and daily insights.</p>
                </div>
                <div className="glass rounded-2xl p-4 hover-lift">
                  <MapPin className="w-5 h-5 text-accent mb-2" />
                  <p className="text-sm font-semibold">Location Safety</p>
                  <p className="text-xs text-muted-foreground">Safe-zone alerts with live caregiver visibility.</p>
                </div>
                <div className="glass rounded-2xl p-4 hover-lift">
                  <ShieldCheck className="w-5 h-5 text-safe mb-2" />
                  <p className="text-sm font-semibold">Protected Accounts</p>
                  <p className="text-xs text-muted-foreground">JWT auth + strong password policy safeguards.</p>
                </div>
                <div className="glass rounded-2xl p-4 hover-lift">
                  <Sparkles className="w-5 h-5 text-warning mb-2" />
                  <p className="text-sm font-semibold">Care Continuity</p>
                  <p className="text-xs text-muted-foreground">Multi-patient support with doctor-ready reports.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="p-6 sm:p-8 lg:p-10 flex items-center">
            <div className="w-full max-w-lg mx-auto">
              <div className="mb-5">
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">Welcome back</h2>
                <p className="text-sm text-muted-foreground mt-1">Sign in or create an account to continue.</p>
              </div>

              <div className="flex rounded-xl bg-muted p-1 mb-4">
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setError("");
                  }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    authMode === "login"
                      ? "bg-primary text-primary-foreground shadow-gentle"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setAuthMode("register");
                    setError("");
                  }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    authMode === "register"
                      ? "bg-primary text-primary-foreground shadow-gentle"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Create Account
                </button>
              </div>

              <div className="flex rounded-xl bg-muted p-1 mb-6">
                <button
                  onClick={() => setRegisterForm((prev) => ({ ...prev, role: "patient" }))}
                  className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    registerForm.role === "patient"
                      ? "bg-primary text-primary-foreground shadow-gentle"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <User className="w-4 h-4" />
                  Patient
                </button>
                <button
                  onClick={() => setRegisterForm((prev) => ({ ...prev, role: "caregiver" }))}
                  className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    registerForm.role === "caregiver"
                      ? "bg-primary text-primary-foreground shadow-gentle"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Caregiver
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {authMode === "register" && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block" htmlFor="fullName">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          id="fullName"
                          aria-label="Full Name"
                          type="text"
                          value={registerForm.name}
                          onChange={(e) => setRegisterForm((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="Jane Doe"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block" htmlFor="username">Username</label>
                      <div className="relative">
                        <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          id="username"
                          aria-label="Username"
                          type="text"
                          value={registerForm.username}
                          onChange={(e) => setRegisterForm((prev) => ({ ...prev, username: e.target.value }))}
                          placeholder="jane.caregiver"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block" htmlFor="dob">Date of Birth</label>
                      <div className="relative">
                        <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          id="dob"
                          aria-label="Date of Birth"
                          type="date"
                          value={registerForm.dob}
                          onChange={(e) => setRegisterForm((prev) => ({ ...prev, dob: e.target.value }))}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>

                    {registerForm.role === "patient" && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block" htmlFor="caregiverId">Caregiver ID (optional)</label>
                        <div className="relative">
                          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            id="caregiverId"
                            aria-label="Caregiver ID"
                            type="text"
                            value={registerForm.caregiverId}
                            onChange={(e) => setRegisterForm((prev) => ({ ...prev, caregiverId: e.target.value }))}
                            placeholder="Mongo ObjectId"
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block" htmlFor="email">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="email"
                      aria-label="Email"
                      type="email"
                      value={authMode === "login" ? loginForm.email : registerForm.email}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (authMode === "login") {
                          setLoginForm((prev) => ({ ...prev, email: value }));
                          return;
                        }
                        setRegisterForm((prev) => ({ ...prev, email: value }));
                      }}
                      placeholder="your@email.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block" htmlFor="password">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="password"
                      aria-label="Password"
                      type={showPassword ? "text" : "password"}
                      value={authMode === "login" ? loginForm.password : registerForm.password}
                      onCopy={blockClipboardAction}
                      onCut={blockClipboardAction}
                      onPaste={blockClipboardAction}
                      onDrop={blockClipboardAction}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (authMode === "login") {
                          setLoginForm((prev) => ({ ...prev, password: value }));
                          return;
                        }
                        setRegisterForm((prev) => ({ ...prev, password: value }));
                      }}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {authMode === "register" && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block" htmlFor="confirmPassword">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        id="confirmPassword"
                        aria-label="Confirm Password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={registerForm.confirmPassword}
                        onCopy={blockClipboardAction}
                        onCut={blockClipboardAction}
                        onPaste={blockClipboardAction}
                        onDrop={blockClipboardAction}
                        onChange={(e) => setRegisterForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {authMode === "register" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Password strength</span>
                      <span className={`${strength.label === "Strong" ? "text-safe" : strength.label === "Medium" ? "text-warning" : "text-alert"}`}>
                        {strength.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className={`h-1.5 rounded-full ${strength.score >= 1 ? "bg-alert" : "bg-muted"}`} />
                      <div className={`h-1.5 rounded-full ${strength.score >= 2 ? "bg-warning" : "bg-muted"}`} />
                      <div className={`h-1.5 rounded-full ${strength.score >= 3 ? "bg-safe" : "bg-muted"}`} />
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Use 8+ chars, uppercase, lowercase, number, special character. Password cannot match username or DOB.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <a href="#" className="text-primary hover:underline">Forgot password?</a>
                  <div className="text-muted-foreground">
                    <a href="#" className="hover:underline">Terms</a> · <a href="#" className="hover:underline">Privacy</a>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-calm"
                >
                  {isSubmitting ? "Submitting..." : authMode === "login" ? "Sign In" : `Create ${registerForm.role} account`}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {error && <p role="alert" aria-live="assertive" className="mt-3 text-center text-xs text-alert">{error}</p>}

              <p className="text-center text-xs text-muted-foreground mt-4 leading-relaxed">
                JWT auth with regex validation for email, username, DOB, and strong password policy.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Index;
