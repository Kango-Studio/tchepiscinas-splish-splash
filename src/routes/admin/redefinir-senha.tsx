import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, FieldError, Input, Label, Link, Spinner, TextField } from "@heroui/react";
import { AuthCard, NotConfiguredNotice } from "@/components/admin/AdminStatusScreen";
import { PendingLabel, StatusAlert } from "@/components/admin/ui";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export const Route = createFileRoute("/admin/redefinir-senha")({
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z.string().min(8, "Use pelo menos 8 caracteres").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "As senhas não conferem",
  });

type Values = z.infer<typeof schema>;

function ResetPasswordPage() {
  const navigate = useNavigate();
  // O link do e-mail traz o token na URL; o cliente Supabase cria a sessão
  // de recuperação automaticamente (detectSessionInUrl).
  const [linkState, setLinkState] = useState<"checking" | "valid" | "invalid">("checking");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN"))
        setLinkState("valid");
    });
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setLinkState((s) => (s === "valid" || data.session ? "valid" : "invalid"));
    }, 800);
    return () => {
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = async ({ password }: Values) => {
    setError(null);
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) {
      setError(
        error.message.toLowerCase().includes("different")
          ? "A nova senha precisa ser diferente da anterior."
          : "Não foi possível atualizar a senha. Solicite um novo link.",
      );
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/admin", replace: true }), 1500);
  };

  if (!isSupabaseConfigured) {
    return (
      <AuthCard>
        <NotConfiguredNotice />
      </AuthCard>
    );
  }

  const passwordField = (name: "password" | "confirm", label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <TextField
          fullWidth
          type="password"
          autoComplete="new-password"
          name={field.name}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          isInvalid={!!errors[name]}
        >
          <Label>{label}</Label>
          <Input />
          <FieldError>{errors[name]?.message}</FieldError>
        </TextField>
      )}
    />
  );

  return (
    <AuthCard>
      <div className="text-center">
        <h1 className="text-xl font-semibold text-pool-deep">Definir nova senha</h1>
      </div>
      {linkState === "checking" ? (
        <div className="flex justify-center py-2">
          <Spinner aria-label="Verificando link" />
        </div>
      ) : linkState === "invalid" ? (
        <>
          <StatusAlert
            status="warning"
            title="Link inválido ou expirado"
            description="Solicite um novo link de recuperação na tela de login."
          />
          <Link href="/admin/login" className="self-center text-sm">
            Ir para o login
          </Link>
        </>
      ) : done ? (
        <StatusAlert
          status="success"
          title="Senha atualizada!"
          description="Redirecionando para o painel..."
        />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          {error && <StatusAlert status="danger" title={error} />}
          {passwordField("password", "Nova senha")}
          {passwordField("confirm", "Confirmar nova senha")}
          <Button type="submit" size="lg" fullWidth isPending={isSubmitting}>
            {({ isPending }) => (
              <PendingLabel isPending={isPending}>Salvar nova senha</PendingLabel>
            )}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
