import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, FieldError, Input, InputGroup, Label, Link, TextField } from "@heroui/react";
import { Eye, EyeSlash } from "@gravity-ui/icons";
import {
  AuthCard,
  FullPageSpinner,
  NotConfiguredNotice,
} from "@/components/admin/AdminStatusScreen";
import { PendingLabel, StatusAlert } from "@/components/admin/ui";
import { useAdminAuth } from "@/components/admin/auth";
import { getSupabase } from "@/lib/supabase/client";

export const Route = createFileRoute("/admin/login")({
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail").email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});
const resetSchema = loginSchema.pick({ email: true });

function LoginPage() {
  const { state } = useAdminAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "reset">("login");

  useEffect(() => {
    if (state.status === "admin") navigate({ to: "/admin", replace: true });
  }, [state.status, navigate]);

  if (state.status === "not_configured") {
    return (
      <AuthCard>
        <NotConfiguredNotice />
      </AuthCard>
    );
  }
  if (state.status === "loading" || state.status === "admin") return <FullPageSpinner />;

  return (
    <AuthCard>
      {mode === "login" ? (
        <LoginForm onForgot={() => setMode("reset")} forbidden={state.status === "forbidden"} />
      ) : (
        <ResetRequestForm onBack={() => setMode("login")} />
      )}
    </AuthCard>
  );
}

function LoginForm({ onForgot, forbidden }: { onForgot: () => void; forbidden: boolean }) {
  const { signIn } = useAdminAuth();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setError(null);
    const result = await signIn(values.email, values.password);
    if (result.error) setError(result.error);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-pool-deep">Painel administrativo</h1>
        <p className="text-sm text-muted">Entre com sua conta de administrador.</p>
      </div>

      {forbidden && (
        <StatusAlert status="danger" title="Esta conta não tem permissão de administrador." />
      )}
      {error && <StatusAlert status="danger" title={error} />}

      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            fullWidth
            type="email"
            autoComplete="email"
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            isInvalid={!!errors.email}
          >
            <Label>E-mail</Label>
            <Input placeholder="voce@tchepiscinas.com" />
            <FieldError>{errors.email?.message}</FieldError>
          </TextField>
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            fullWidth
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            isInvalid={!!errors.password}
          >
            <Label>Senha</Label>
            <InputGroup>
              <InputGroup.Input />
              <InputGroup.Suffix>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onPress={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </InputGroup.Suffix>
            </InputGroup>
            <FieldError>{errors.password?.message}</FieldError>
          </TextField>
        )}
      />
      <Button type="submit" size="lg" fullWidth isPending={isSubmitting} className="mt-1">
        {({ isPending }) => <PendingLabel isPending={isPending}>Entrar</PendingLabel>}
      </Button>
      <Link className="self-center text-sm" onPress={onForgot}>
        Esqueci minha senha
      </Link>
    </form>
  );
}

function ResetRequestForm({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: z.infer<typeof resetSchema>) => {
    setError(null);
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/redefinir-senha`,
    });
    // Não revela se o e-mail existe; só mostra erro de limite/conexão.
    if (error && error.status === 429) {
      setError("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
      return;
    }
    if (error && !error.status) {
      setError("Não foi possível enviar agora. Verifique sua conexão.");
      return;
    }
    setSent(true);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="animate-admin-rise flex flex-col gap-4"
    >
      <div className="text-center">
        <h1 className="text-xl font-semibold text-pool-deep">Recuperar senha</h1>
        <p className="text-sm text-muted">Enviaremos um link para redefinir a senha.</p>
      </div>
      {sent ? (
        <StatusAlert
          status="success"
          title="Verifique seu e-mail"
          description="Se houver uma conta com este endereço, você receberá o link em instantes."
        />
      ) : (
        <>
          {error && <StatusAlert status="danger" title={error} />}
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <TextField
                fullWidth
                type="email"
                autoComplete="email"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isInvalid={!!errors.email}
              >
                <Label>E-mail</Label>
                <Input placeholder="voce@tchepiscinas.com" />
                <FieldError>{errors.email?.message}</FieldError>
              </TextField>
            )}
          />
          <Button type="submit" size="lg" fullWidth isPending={isSubmitting}>
            {({ isPending }) => <PendingLabel isPending={isPending}>Enviar link</PendingLabel>}
          </Button>
        </>
      )}
      <Link className="self-center text-sm" onPress={onBack}>
        Voltar para o login
      </Link>
    </form>
  );
}
