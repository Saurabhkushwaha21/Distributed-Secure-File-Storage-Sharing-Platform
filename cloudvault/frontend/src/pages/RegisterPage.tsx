import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { authApi } from "@/services/authApi";
import { getErrorMessage } from "@/utils/errors";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  function passwordStrength(pw: string): { label: string; ratio: number } {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
    return { label: labels[score], ratio: score / 4 };
  }
  const strength = passwordStrength(password);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await authApi.register(email, password, fullName);
      navigate("/verify-email", { state: { email } });
    } catch (err: any) {
      setError(getErrorMessage(err, "Registration failed. Try a different email."));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout title="Create your vault" subtitle="15GB free storage to start.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input label="Full name" name="full_name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div>
          <Input
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {password.length > 0 && (
            <div className="mt-1.5">
              <div className="h-1 w-full overflow-hidden rounded bg-steel-hairline">
                <div
                  className="h-full bg-brass transition-all"
                  style={{ width: `${Math.max(strength.ratio * 100, 8)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-steel">{strength.label} · at least 8 characters</p>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded bg-signal-redSoft px-3 py-2 text-sm text-signal-red">
            {error}
          </p>
        )}

        <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-steel">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-brass hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
