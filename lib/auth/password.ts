import bcrypt from "bcryptjs";

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

export function validatePasswordStrength(password: string): string[] {
  const errors: string[] = [];
  if (password.length < MIN_LENGTH) errors.push("Use at least 8 characters.");
  if (password.length > MAX_LENGTH) errors.push("Password is too long.");
  if (!/[A-Za-z]/.test(password)) errors.push("Include at least one letter.");
  if (!/[0-9]/.test(password)) errors.push("Include at least one number.");
  return errors;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
