import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function BackToDashboard() {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors mb-4"
    >
      <ArrowLeft className="w-4 h-4" />
    </button>
  );
}
