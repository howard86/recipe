type UserRole = "USER" | "STAFF" | "ADMIN";

export function canAccessAdmin(role: UserRole) {
  return role === "ADMIN";
}
