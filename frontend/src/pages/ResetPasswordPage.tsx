import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { authApi } from "@/services/authApi";
import { getErrorMessage } from "@/utils/errors";

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const emailFromState = (location.state as { email?: string })?.email ?? "";

  const [email, setEmail] = useState(emailFromState);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await authApi.resetPassword(email, code, newPassword);
      navigate("/login", { state: { justReset: true } });
    } catch (err: any) {
      setError(getErrorMessage(err, "Couldn't reset your password. Check the code and try again."));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout title="Set a new password" subtitle="This will sign you out everywhere else.">
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
          label="Reset code"
          name="code"
          required
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="font-mono tracking-[0.3em]"
        />
        <Input
          label="New password"
          type="password"
          name="new_password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="rounded bg-signal-redSoft px-3 py-2 text-sm text-signal-red">
            {error}
          </p>
        )}
        <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
          Reset password
        </Button>
      </form>
    </AuthLayout>
  );
}
