import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Alert, Button, Input, Link, Spinner } from "@heroui/react";
import { AuthCard, NotConfiguredNotice } from "@/components/admin/AdminStatusScreen";
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

  return (
    <AuthCard>
      <div className="text-center">
        <h1 className="text-xl font-bold text-pool-deep">Definir nova senha</h1>
      </div>
      {linkState === "checking" ? (
        <Spinner color="primary" className="mx-auto" />
      ) : linkState === "invalid" ? (
        <>
          <Alert
            color="warning"
            title="Link inválido ou expirado"
            description="Solicite um novo link de recuperação na tela de login."
          />
          <Link href="/admin/login" className="self-center" size="sm">
            Ir para o login
          </Link>
        </>
      ) : done ? (
        <Alert
          color="success"
          title="Senha atualizada!"
          description="Redirecionando para o painel..."
        />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          {error && <Alert color="danger" title={error} />}
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <Input
                label="Nova senha"
                type="password"
                autoComplete="new-password"
                variant="bordered"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                isInvalid={!!errors.password}
                errorMessage={errors.password?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="confirm"
            render={({ field }) => (
              <Input
                label="Confirmar nova senha"
                type="password"
                autoComplete="new-password"
                variant="bordered"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                isInvalid={!!errors.confirm}
                errorMessage={errors.confirm?.message}
              />
            )}
          />
          <Button
            type="submit"
            color="primary"
            size="lg"
            isLoading={isSubmitting}
            className="font-semibold"
          >
            Salvar nova senha
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
