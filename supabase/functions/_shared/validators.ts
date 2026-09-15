/**
 * Input Validators for SaaS Security & Data Integrity
 */

export function validateEmail(email: string): boolean {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.toLowerCase());
}

export function validatePhone(phone: string): boolean {
  if (!phone) return false;
  // Validates Indian phone numbers (10 digits, optional country code +91 or 0)
  const re = /^(?:\+91|0)?[6-9]\d{9}$/;
  return re.test(phone.trim());
}

export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long." };
  }
  let score = 0;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score < 4) {
    return { 
      valid: false, 
      error: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character." 
    };
  }
  return { valid: true };
}

export function validatePrice(price: number): boolean {
  return typeof price === 'number' && !isNaN(price) && price >= 0;
}

export function sanitizeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
