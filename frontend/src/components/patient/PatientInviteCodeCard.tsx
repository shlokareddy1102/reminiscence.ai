import { useEffect, useState } from "react";
import { Copy, RefreshCw, Loader2, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

export default function PatientInviteCodeCard() {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadInviteCode();
  }, []);

  const loadInviteCode = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiRequest("/api/patient/invite-code/view");
      setInviteCode(response.inviteCode);
      setExpiresAt(response.expiresAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invite code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateCode = async () => {
    setIsRegenerating(true);
    setError(null);
    try {
      const response = await apiRequest("/api/patient/invite-code/regenerate", {
        method: "POST",
        body: JSON.stringify({})
      });
      setInviteCode(response.inviteCode);
      setExpiresAt(response.expiresAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate code");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getDaysUntilExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const expiry = new Date(expiresAt);
    const now = new Date();
    const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const daysLeft = getDaysUntilExpiry(expiresAt);

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Share with Caregiver</h3>
        <p className="text-sm text-muted-foreground">Give your caregiver this code to add you to their dashboard</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {inviteCode && (
        <>
          {/* Code Display */}
          <div className="bg-muted/50 border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-2 uppercase font-medium">Your Invite Code</p>
            <div className="flex items-center justify-between gap-3">
              <code className="text-3xl font-mono font-bold text-foreground tracking-widest">
                {inviteCode}
              </code>
              <button
                onClick={handleCopyCode}
                className="flex-shrink-0 p-2 hover:bg-muted rounded-lg transition-colors"
                title="Copy code"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          {/* Expiry Info */}
          <div className="flex items-center justify-between text-sm p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <span className="text-amber-700">
              Expires in <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong>
            </span>
            <button
              onClick={handleRegenerateCode}
              disabled={isRegenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-medium transition-colors disabled:opacity-50"
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3" />
                  Regenerate
                </>
              )}
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              <strong>How to share:</strong> Send this code to your caregiver. They'll enter it in their app to get access to your health information.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
