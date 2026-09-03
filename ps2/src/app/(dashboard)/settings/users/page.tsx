"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { ROLE_PERMISSIONS } from "@/lib/constants";
import type { User, UserRole } from "@/lib/types";

export default function UsersSettingsPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    full_name: "",
    role: "sahasra_employee" as UserRole,
    outlook_account: "",
    is_active: true,
  });

  const loadUsers = async () => {
    const res = await fetch("/api/users");
    const json = await res.json();
    if (json.success) setUsers(json.data);
  };

  useEffect(() => {
    if (user?.role === "sahasra_admin") loadUsers();
  }, [user]);

  if (user?.role !== "sahasra_admin") {
    return (
      <>
        <Header title="Users" userName={user?.full_name ?? ""} userRole={user?.role ?? "sahasra_admin"} />
        <div className="p-6 text-gray-500">You do not have permission to view this page.</div>
      </>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setForm({ username: "", password: "", full_name: "", role: "sahasra_employee", outlook_account: "", is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({
      username: u.username,
      password: "",
      full_name: u.full_name,
      role: u.role,
      outlook_account: u.outlook_account ?? "",
      is_active: u.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editing) {
      await fetch(`/api/users/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setDialogOpen(false);
    loadUsers();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this user?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    loadUsers();
  };

  return (
    <>
      <Header title="User Management" userName={user?.full_name ?? ""} userRole={user?.role ?? "sahasra_admin"} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex justify-end">
          <Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> Add User</Button>
        </div>

        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Outlook</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell>{u.full_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROLE_PERMISSIONS[u.role]?.label}</Badge>
                  </TableCell>
                  <TableCell>{u.outlook_account ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "default" : "secondary"}>
                      {u.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(u.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={!!editing} /></div>
            <div><Label>{editing ? "New Password (leave blank to keep)" : "Password"}</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div><Label>Full Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sahasra_admin">Sahasra Admin</SelectItem>
                  <SelectItem value="sahasra_employee">Sahasra Employee</SelectItem>
                  <SelectItem value="pt_admin">PT Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Outlook Account</Label><Input value={form.outlook_account} onChange={(e) => setForm({ ...form, outlook_account: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
