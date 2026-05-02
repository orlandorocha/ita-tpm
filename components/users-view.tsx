"use client";

import { useState } from "react";
import { useUsers } from "@/hooks/useUsers";
import { useWorkers } from "@/hooks/useWorkers";
import { useApp } from "@/lib/app-context";
import { resolveCurrentUserWorkerId } from "@/lib/utils";
import type { User, UserInput, UserRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  UserCircle,
  Shield,
  ShieldCheck,
  HardHat,
  Wrench,
  Search,
  Mail,
} from "lucide-react";

const LINKED_FIELD_ROLES: UserRole[] = ["Manutentor", "Operador"];

const roleIcons: Record<UserRole, React.ReactNode> = {
  Administrador: <ShieldCheck className="h-4 w-4" />,
  Supervisor: <Shield className="h-4 w-4" />,
  Manutentor: <Wrench className="h-4 w-4" />,
  Operador: <HardHat className="h-4 w-4" />,
};

const roleColors: Record<UserRole, string> = {
  Administrador: "bg-status-critical/10 text-status-critical border-status-critical/20",
  Supervisor: "bg-status-warning/10 text-status-warning border-status-warning/20",
  Manutentor: "bg-status-info/10 text-status-info border-status-info/20",
  Operador: "bg-primary/10 text-primary border-primary/20",
};

interface UserFormData extends UserInput {
  active: boolean;
}

const emptyForm: UserFormData = {
  name: "",
  email: "",
  password: "",
  role: "Manutentor",
  workerId: "",
  active: true,
};

export function UsersView() {
  const { users, create, update, remove, getAll, loading, error } = useUsers();
  const { workers } = useWorkers();
  const { state, refreshCurrentUser } = useApp();
  const currentUser = state.currentUser;

  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.role.toLowerCase().includes(search.toLowerCase())
  );

  const availableWorkers = workers.filter(
    (worker) => !users.some((user) => user.workerId === worker.id && user.id !== editingUser?.id)
  );

  const resolveSuggestedWorkerId = (name: string, workerId?: string) => {
    const availablePool = availableWorkers.concat(
      editingUser?.workerId
        ? workers.filter((worker) => worker.id === editingUser.workerId)
        : []
    );

    return (
      resolveCurrentUserWorkerId(
        {
          name,
          workerId,
        },
        Array.from(new Map(availablePool.map((worker) => [worker.id, worker])).values())
      ) ?? ""
    );
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      workerId: user.workerId || "",
      active: user.active,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (LINKED_FIELD_ROLES.includes(form.role) && !form.workerId) {
      setFormError(`Usuários com perfil ${form.role} precisam estar vinculados a um manutentor cadastrado.`);
      return;
    }

    let result: User | null;

    if (editingUser) {
      result = await update(editingUser.id, {
        name: form.name,
        email: form.email,
        password: form.password || undefined,
        role: form.role,
        workerId: form.workerId || undefined,
        active: form.active,
      });

      if (!result) {
        return;
      }

      if (editingUser.id === currentUser?.id) {
        await refreshCurrentUser();
      }
    } else {
      result = await create({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        workerId: form.workerId || undefined,
        active: form.active,
      });

      if (!result) {
        return;
      }
    }

    await getAll();

    setIsModalOpen(false);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleDelete = async (id: string) => {
    const removed = await remove(id);
    if (!removed) {
      return;
    }

    setDeleteConfirm(null);
  };

  const getWorkerName = (workerId?: string) => {
    if (!workerId) return "—";
    const worker = workers.find((item) => item.id === workerId);
    return worker ? worker.name : "—";
  };

  const canManage = currentUser?.role === "Administrador";

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Usuários</h1>
          <p className="text-muted-foreground mt-1">Gerencie os perfis de acesso ao sistema</p>
        </div>

        {canManage && (
          <Button onClick={openCreateModal} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Usuário
          </Button>
        )}
      </div>

      <div className="relative max-w-md w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, e-mail ou perfil..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-10"
        />
      </div>

      {loading && users.length === 0 && (
        <div className="py-16 text-center text-muted-foreground text-sm">Carregando usuários...</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredUsers.map((user) => (
          <Card key={user.id} className={`${!user.active ? "opacity-60" : ""}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">{user.name}</CardTitle>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </div>
                  </div>
                </div>
                {!user.active && (
                  <Badge variant="secondary" className="text-xs">
                    Inativo
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Perfil:</span>
                <Badge variant="outline" className={`gap-1.5 ${roleColors[user.role]}`}>
                  {roleIcons[user.role]}
                  {user.role}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Vínculo:</span>
                <span className="text-sm font-medium">{getWorkerName(user.workerId)}</span>
              </div>

              {canManage && user.id !== currentUser?.id && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => openEditModal(user)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => setDeleteConfirm(user.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && filteredUsers.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <UserCircle className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Nenhum usuário encontrado.</p>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="grid max-h-[calc(100vh-2rem)] max-w-md grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-4 pr-12">
            <DialogTitle>{editingUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>Nome Completo</FieldLabel>
                  <Input
                    value={form.name}
                    onChange={(event) => {
                      const name = event.target.value;
                      setForm((current) => {
                        if (!LINKED_FIELD_ROLES.includes(current.role)) {
                          return { ...current, name };
                        }

                        const suggestedWorkerId = resolveSuggestedWorkerId(name, current.workerId || undefined);
                        return {
                          ...current,
                          name,
                          workerId: current.workerId || suggestedWorkerId,
                        };
                      });
                    }}
                    placeholder="Nome do usuário"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>E-mail</FieldLabel>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="email@empresa.com"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>
                    {editingUser ? "Nova Senha (deixe em branco para manter)" : "Senha"}
                  </FieldLabel>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    placeholder="••••••••"
                    required={!editingUser}
                  />
                </Field>

                <Field>
                  <FieldLabel>Perfil de Acesso</FieldLabel>
                  <Select
                    value={form.role}
                    onValueChange={(value) => {
                      const nextRole = value as UserRole;
                      const suggestedWorkerId =
                        LINKED_FIELD_ROLES.includes(nextRole)
                          ? resolveSuggestedWorkerId(form.name, form.workerId || undefined)
                          : "";

                      setFormError(null);
                      setForm({
                        ...form,
                        role: nextRole,
                        workerId: LINKED_FIELD_ROLES.includes(nextRole) ? form.workerId || suggestedWorkerId : "",
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Administrador">Administrador</SelectItem>
                      <SelectItem value="Supervisor">Supervisor</SelectItem>
                      <SelectItem value="Manutentor">Manutentor</SelectItem>
                      <SelectItem value="Operador">Operador</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>
                    {LINKED_FIELD_ROLES.includes(form.role)
                      ? "Vincular a Manutentor"
                      : "Vincular a Manutentor (opcional)"}
                  </FieldLabel>
                  <Select
                    value={form.workerId || "none"}
                    onValueChange={(value) => {
                      setFormError(null);
                      setForm({ ...form, workerId: value === "none" ? "" : value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um manutentor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {availableWorkers.map((worker) => (
                        <SelectItem key={worker.id} value={worker.id}>
                          {worker.name} ({worker.registration})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {LINKED_FIELD_ROLES.includes(form.role) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Esse vínculo define quais OS e apontamentos o usuário poderá visualizar. Se houver um manutentor com o mesmo nome, ele será sugerido automaticamente.
                    </p>
                  )}
                </Field>

                {formError && <p className="text-sm text-destructive">{formError}</p>}

                <Field>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="active"
                      checked={form.active}
                      onChange={(event) => setForm({ ...form, active: event.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                    <FieldLabel htmlFor="active" className="mb-0">
                      Usuário ativo
                    </FieldLabel>
                  </div>
                </Field>
              </FieldGroup>
            </div>

            <div className="flex shrink-0 gap-2 border-t border-border px-6 py-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                {editingUser ? "Salvar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteConfirm)} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir usuário</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação remove o usuário definitivamente.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => deleteConfirm && void handleDelete(deleteConfirm)}
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  );
}