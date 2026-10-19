"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteAdminUser } from "@/lib/auth/admin-user-deletion-service";
import { createAdminUser, setAdminUserPassword, sendAdminUserPasswordEmail, updateAdminUserAccess } from "@/lib/auth/admin-user-service";
import { ApplicationError } from "@/lib/errors/application-error";

export type UserFormState = { error: string | null; success: string | null };

export async function createUserAction(_previous: UserFormState, data: FormData): Promise<UserFormState> {
  let result;
  try {
    result = await createAdminUser({
      email: data.get("email"), role: data.get("role"),
      passwordMode: data.get("passwordMode") ?? "email",
      password: data.get("password") ?? undefined,
      confirmation: data.get("confirmation") ?? undefined,
    });
  } catch (error) {
    revalidatePath("/admin/users");
    return { error: error instanceof ApplicationError ? error.message : "Não foi possível criar a conta. Atualize a lista antes de tentar novamente.", success: null };
  }
  revalidatePath("/admin/users");
  return { error: null, success: result.passwordMode === "manual"
    ? "Conta criada com a senha definida no painel. Nenhum e-mail foi enviado."
    : "Conta criada. Link para definir a senha enviado ao e-mail cadastrado." };
}

export async function updateUserAccessAction(_previous: UserFormState, data: FormData): Promise<UserFormState> {
  try {
    await updateAdminUserAccess({
      userId: data.get("userId"),
      role: data.get("role"),
      isActive: data.get("isActive") === "on",
    });
  } catch (error) {
    return { error: error instanceof ApplicationError ? error.message : "Não foi possível alterar o acesso. Atualize a lista e tente novamente.", success: null };
  }
  revalidatePath("/admin/users");
  return { error: null, success: "Acesso atualizado." };
}

export async function sendPasswordEmailAction(_previous: UserFormState, data: FormData): Promise<UserFormState> {
  try {
    await sendAdminUserPasswordEmail(data.get("userId"));
  } catch (error) {
    return { error: error instanceof ApplicationError ? error.message : "Não foi possível enviar o link. Tente novamente.", success: null };
  }
  return { error: null, success: "Link para definir uma nova senha enviado ao e-mail cadastrado. Confira também o spam." };
}

export async function deleteUserAction(_previous: UserFormState, data: FormData): Promise<UserFormState> {
  try {
    await deleteAdminUser({ userId: data.get("userId"), confirmation: data.get("confirmation") });
  } catch (error) {
    return { error: error instanceof ApplicationError ? error.message : "Não foi possível confirmar a exclusão. Atualize a lista e tente novamente.", success: null };
  }
  revalidatePath("/admin/users");
  redirect("/admin/users?status=deleted");
}

export async function setUserPasswordAction(_previous: UserFormState, data: FormData): Promise<UserFormState> {
  try {
    await setAdminUserPassword({
      userId: data.get("userId"), password: data.get("password"), confirmation: data.get("confirmation"),
    });
  } catch (error) {
    return { error: error instanceof ApplicationError ? error.message : "Não foi possível confirmar a alteração da senha. Tente novamente.", success: null };
  }
  return { error: null, success: "Senha definida com sucesso. Use a nova senha no próximo acesso." };
}
