import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { authApi } from "@/services/authApi";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authApi.forgotPassword(email);
    } finally {
      setIsLoading(false);
      setSubmitted(true); // Always show the same message, regardless of whether the email exists
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a reset code.">
      {submitted ? (
        <div className="flex flex-col gap-4">
          <p className="rounded bg-vault-greenSoft px-3 py-2 text-sm text-vault-green">
            If that email has a CloudVault account, a reset code is on its way.
          </p>
          <Button variant="secondary" onClick={() => navigate("/reset-password", { state: { email } })}>
            I have my code
          </Button>
        </div>
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
          <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
            Send reset code
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
