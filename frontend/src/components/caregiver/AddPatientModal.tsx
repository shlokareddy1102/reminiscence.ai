import { useState } from "react";
import { X, Loader2, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPatient: (inviteCode: string) => Promise<void>;
}

export default function AddPatientModal({
  isOpen,
  onClose,
  onAddPatient
}: AddPatientModalProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteCode.trim()) {
      setError("Please enter an invite code");
      return;
    }

    setIsAdding(true);
    setError(null);
    try {
      await onAddPatient(inviteCode.trim());
      setSuccess(true);
      setInviteCode("");
      
      // Close modal after 1.5 seconds so user sees the success state
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add patient");
      setSuccess(false);
    } finally {
      setIsAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl shadow-xl max-w-md w-full border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Add Patient</h2>
          <button
            onClick={onClose}
            disabled={isAdding}
            className="p-1 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleAddPatient} className="p-6 space-y-4">
          {/* Info Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              Ask the patient to share their <strong>6-character invite code</strong>. They can find it in their dashboard under "Share with Caregiver".
            </p>
          </div>

          {/* Input Field */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Invite Code
            </label>
            <Input
              type="text"
              placeholder="e.g., ABC123"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              disabled={isAdding || success}
              maxLength={6}
              className="w-full text-center text-lg font-mono tracking-widest"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              Codes are valid for 7 days
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Check className="w-4 h-4 text-green-700 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-700">Patient added successfully!</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isAdding}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isAdding || !inviteCode.trim() || success}
              className="flex-1"
            >
              {isAdding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : success ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Added!
                </>
              ) : (
                "Add Patient"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
