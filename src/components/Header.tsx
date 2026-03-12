import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, LogIn, LogOut, Shield, ShieldAlert, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

export function Header() {
  const { user, isAdmin, isSuperAdmin, signOut, login } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setMenuOpen(false);
    navigate("/");
  };

  const handleSignIn = () => {
    login();
    setMenuOpen(false);
  };

  const closeMenu = () => setMenuOpen(false);

  const navLinks = (
    <>
      <Link to="/" onClick={closeMenu} className="hover:text-foreground transition-colors">Dashboard</Link>
      <Link to="/developer" onClick={closeMenu} className="hover:text-foreground transition-colors">API</Link>
      {user && (
        <Link to="/nodes" onClick={closeMenu} className="hover:text-foreground transition-colors">Nodes</Link>
      )}
      {isAdmin && (
        <Link to="/admin" onClick={closeMenu} className="hover:text-foreground transition-colors flex items-center gap-1">
          <Shield className="w-3 h-3" /> Admin
        </Link>
      )}
      {isSuperAdmin && (
        <Link to="/super-admin" onClick={closeMenu} className="hover:text-foreground transition-colors flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" /> Super
        </Link>
      )}
      {user ? (
        <button onClick={handleSignOut} className="hover:text-foreground transition-colors flex items-center gap-1">
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      ) : (
        <button onClick={handleSignIn} className="hover:text-foreground transition-colors flex items-center gap-1">
          <LogIn className="w-3.5 h-3.5" /> Sign In
        </button>
      )}
    </>
  );

  return (
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

        {/* Desktop nav */}
        {!isMobile && (
          <nav className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
            {navLinks}
          </nav>
        )}

        {/* Mobile hamburger */}
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

      {/* Mobile dropdown */}
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
  );
}
