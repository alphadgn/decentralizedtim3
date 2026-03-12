import { motion } from "framer-motion";
import { Globe, Github, LogIn, LogOut, Shield, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";

export function Header() {
  const { user, isAdmin, isSuperAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

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
        <nav className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">Dashboard</Link>
          <Link to="/developer" className="hover:text-foreground transition-colors">API</Link>
          {user && (
            <Link to="/nodes" className="hover:text-foreground transition-colors">Nodes</Link>
          )}
          {isAdmin && (
            <Link to="/admin" className="hover:text-foreground transition-colors flex items-center gap-1">
              <Shield className="w-3 h-3" /> Admin
            </Link>
          )}
          {isSuperAdmin && (
            <Link to="/super-admin" className="hover:text-foreground transition-colors flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Super
            </Link>
          )}
          {user ? (
            <button onClick={handleSignOut} className="hover:text-foreground transition-colors flex items-center gap-1">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          ) : (
            <Link to="/auth" className="hover:text-foreground transition-colors flex items-center gap-1">
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </Link>
          )}
        </nav>
      </div>
    </motion.header>
  );
}
