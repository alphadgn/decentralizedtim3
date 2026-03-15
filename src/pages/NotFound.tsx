import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Header } from "@/components/Header";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Header />
      <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="text-6xl font-mono font-bold text-primary mb-4">404</h1>
        <p className="text-lg font-mono text-muted-foreground mb-6">Page not found</p>
        <Link
          to="/"
          className="bg-primary text-primary-foreground rounded-lg px-6 py-2.5 text-sm font-mono font-semibold hover:opacity-90 transition-opacity"
        >
          Return to Dashboard
        </Link>
        <p className="mt-8 text-[10px] font-mono text-muted-foreground">
          Need help? <a href="mailto:decentralizedtim3@gmail.com" className="text-primary hover:underline">decentralizedtim3@gmail.com</a>
        </p>
      </div>
    </div>
  );
};

export default NotFound;
