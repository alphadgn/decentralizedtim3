import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, LogIn, LogOut, Shield, ShieldAlert, Menu, X, AlertTriangle, BarChart3, TrendingUp, User, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

const AUTH_REDIRECT_ORIGIN = "https://defitime.io";
// Only exact origins that are registered in Privy's allowed_domains.
// Preview/branch domains (id-preview--*.lovable.app) are NOT allowlisted
// by Privy and will get 403, so they must redirect to production.
const PRIVY_ALLOWED_ORIGINS = new Set([
  "https://defitime.io",
  "http://defitime.io",
  "https://www.defitime.io",
  "http://www.defitime.io",
  "https://decentralizedtim3.lovable.app",
  "https://www.decentralizedtim3.lovable.app",
  "https://604fe7d4-ffda-4369-8729-382130c9bc18.lovableproject.com",
  "https://www.604fe7d4-ffda-4369-8729-382130c9bc18.lovableproject.com",
]);

const canOpenPrivyModal = (origin: string) => PRIVY_ALLOWED_ORIGINS.has(origin);

export function Header() {
  const { user, isAdmin, isSuperAdmin, isAuditor, isSupport, signOut, login, blocked, unauthorized, attemptCount } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  // If blocked, hide navbar entirely
  if (blocked) return null;

  const handleSignOut = async () => {
    await signOut();
    setMenuOpen(false);
    navigate("/");
  };

  const handleSignIn = async () => {
    const currentOrigin = window.location.origin;

    // In embedded preview contexts, open production domain in a new tab (cross-origin iframes block _top).
    if (!canOpenPrivyModal(currentOrigin)) {
      const redirectPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const redirectUrl = new URL(redirectPath, AUTH_REDIRECT_ORIGIN).toString();
      toast.info("Opening sign-in on production domain…");
      window.open(redirectUrl, "_blank");
      return;
    }

    try {
      await login();
    } catch (error) {
      console.error("Privy sign-in failed", error);
      toast.error("Sign-in failed — please try again.");
    } finally {
      setMenuOpen(false);
    }
  };

  const closeMenu = () => setMenuOpen(false);

  const navLinks = (
    <>
      <Link to="/" onClick={closeMenu} className="hover:text-foreground transition-colors">Dashboard</Link>
      <Link to="/developer" onClick={closeMenu} className="hover:text-foreground transition-colors">API</Link>
      <Link to="/pricing" onClick={closeMenu} className="hover:text-foreground transition-colors flex items-center gap-1">
        <CreditCard className="w-3 h-3" /> Pricing
      </Link>
      {user && (
        <>
          <Link to="/dashboard" onClick={closeMenu} className="hover:text-foreground transition-colors flex items-center gap-1">
            <BarChart3 className="w-3 h-3" /> Dev Dashboard
          </Link>
          <Link to="/enterprise/trading" onClick={closeMenu} className="hover:text-foreground transition-colors flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Trading
          </Link>
          <Link to="/nodes" onClick={closeMenu} className="hover:text-foreground transition-colors">Nodes</Link>
          <Link to="/profile" onClick={closeMenu} className="hover:text-foreground transition-colors flex items-center gap-1">
            <User className="w-3 h-3" /> Profile
          </Link>
        </>
      )}
      {(isAdmin || isSupport) && (
        <Link to="/admin" onClick={closeMenu} className="hover:text-foreground transition-colors flex items-center gap-1">
          <Shield className="w-3 h-3" /> Admin
        </Link>
      )}
      {isSuperAdmin && (
        <Link to="/super-admin" onClick={closeMenu} className="hover:text-foreground transition-colors flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" /> Super
        </Link>
      )}
      {(isSuperAdmin || isAuditor) && (
        <Link to="/security" onClick={closeMenu} className="hover:text-foreground transition-colors flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Security
        </Link>
      )}
      {user ? (
        <button onClick={handleSignOut} className="hover:text-foreground transition-colors flex items-center gap-1">
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      ) : (
        <button onClick={() => void handleSignIn()} className="hover:text-foreground transition-colors flex items-center gap-1">
          <LogIn className="w-3.5 h-3.5" /> Sign In
        </button>
      )}
    </>
  );

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border/50 backdrop-blur-xl sticky top-0 z-50"
        style={{ background: "hsl(var(--background) / 0.8)" }}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-primary" />
              <span className="font-mono text-sm font-semibold tracking-wider text-foreground">
                DGTN
              </span>
            </Link>
            <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
              Decentralized Global Time Network
            </span>
          </div>

          {!isMobile && (
            <nav className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
              {navLinks}
            </nav>
          )}

          {isMobile && (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>

        <AnimatePresence>
          {isMobile && menuOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-border/50"
              style={{ background: "hsl(var(--background) / 0.95)" }}
            >
              <div className="flex flex-col gap-3 px-6 py-4 text-sm font-mono text-muted-foreground">
                {navLinks}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Unauthorized warning banner */}
      <AnimatePresence>
        {unauthorized && !blocked && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="border-b border-destructive/30 bg-destructive/10 px-4 py-3"
          >
            <div className="max-w-7xl mx-auto flex items-center gap-3 text-sm font-mono">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <span className="text-destructive">
                Unauthorized sign-in attempt. This email is not approved.
                {attemptCount >= 2
                  ? " Access has been permanently revoked."
                  : ` Attempt ${attemptCount} of 2 — further attempts will result in permanent access revocation.`}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
