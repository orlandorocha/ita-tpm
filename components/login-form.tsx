"use client";

import Image from "next/image";
import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

export function LoginForm() {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const success = await login(email, password);
    if (!success) {
      setError("E-mail ou senha inválidos");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto relative flex h-16 w-40 items-center justify-center rounded-2xl border border-border bg-background px-4 shadow-sm">
            <Image
              src="/pepsico-logo.png"
              alt="PepsiCo"
              fill
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-foreground">
              Manutenção
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              Sistema de Gestão de Manutenção Industrial
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                  autoComplete="email"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Senha</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
            </FieldGroup>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
{/* Demo Credentials 
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center mb-3">
              Credenciais de demonstração:
            </p>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="flex justify-between px-3 py-2 bg-muted/50 rounded-md">
                <span className="text-muted-foreground">Admin:</span>
                <span className="font-mono text-foreground">admin@manutencao.com / admin123</span>
              </div>
              <div className="flex justify-between px-3 py-2 bg-muted/50 rounded-md">
                <span className="text-muted-foreground">Supervisor:</span>
                <span className="font-mono text-foreground">marcos@manutencao.com / 123456</span>
              </div>
              <div className="flex justify-between px-3 py-2 bg-muted/50 rounded-md">
                <span className="text-muted-foreground">Manutentor:</span>
                <span className="font-mono text-foreground">carlos@manutencao.com / 123456</span>
              </div>
            </div>
          </div>
*/}

        </CardContent>
      </Card>
    </div>
  );
}
