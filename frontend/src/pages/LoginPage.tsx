import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAppDispatch } from "@/hooks/redux";
import { login } from "@/store/authSlice";
import { showToast } from "@/store/toastSlice";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from ?? "/dashboard";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await dispatch(login({ email, password, rememberMe })).unwrap();
      dispatch(showToast("Welcome back.", "success"));
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(typeof err === "string" ? err : "Couldn't sign you in. Check your email and password.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout title="Sign in" subtitle="Access your vault.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-steel">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-steel-hairline text-brass focus-visible:ring-brass"
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="text-brass hover:underline">
            Forgot password?
          </Link>
        </div>

        {error && (
          <p role="alert" className="rounded bg-signal-redSoft px-3 py-2 text-sm text-signal-red">
            {error}
          </p>
        )}

        <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-steel">
        New to CloudVault?{" "}
        <Link to="/register" className="font-medium text-brass hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
