import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { authApi } from "@/services/authApi";
import { getErrorMessage } from "@/utils/errors";

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const emailFromState = (location.state as { email?: string })?.email ?? "";

  const [email, setEmail] = useState(emailFromState);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await authApi.verifyEmail(email, code);
      setSuccess(true);
      setTimeout(() => navigate("/login"), 1500);
    } catch (err: any) {
      setError(getErrorMessage(err, "That code didn't work. Check it and try again."));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout title="Verify your email" subtitle="Enter the 6-digit code we sent you.">
      {success ? (
        <p className="rounded bg-vault-greenSoft px-3 py-2 text-sm text-vault-green">
          Email verified. Taking you to sign in…
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            label="Email"
            type="email"
            name="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Verification code"
            name="code"
            required
            maxLength={6}
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="tracking-[0.3em] font-mono"
          />
          {error && (
            <p role="alert" className="rounded bg-signal-redSoft px-3 py-2 text-sm text-signal-red">
              {error}
            </p>
          )}
          <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
            Verify email
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
