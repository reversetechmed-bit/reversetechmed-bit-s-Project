const identifierPattern = /^[- A-Z0-9\u0621-\u064A\u0660-\u0669\u0670-\u06FF]+$/;

export type DepartmentValues = { name: string; code: string };
export type EmployeeValues = { fullName: string; email: string; employeeCode: string; jobTitle: string };

export function normalizeOrganizationIdentifier(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function identifierMessage(label: string, value: string, maximum: number) {
  const normalized = normalizeOrganizationIdentifier(value);
  if (normalized.length < 2) return `${label} يجب أن يتكون من حرفين على الأقل.`;
  if (normalized.length > maximum) return `${label} طويل أكثر من اللازم.`;
  if (!identifierPattern.test(normalized)) return `${label} يقبل الحروف العربية أو الإنجليزية والأرقام والمسافات والشرطة فقط.`;
  return null;
}

export function validateDepartmentForm(values: DepartmentValues) {
  if (values.name.trim().length < 2) return "اكتب اسم القسم بشكل صحيح.";
  return identifierMessage("رمز القسم", values.code, 32);
}

export function validateEmployeeForm(values: EmployeeValues) {
  if (values.fullName.trim().length < 2) return "اكتب الاسم الكامل للموظف.";
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) return "اكتب بريدًا إلكترونيًا صحيحًا للموظف.";
  if (values.jobTitle.trim().length < 2) return "اكتب المسمى الوظيفي للموظف.";
  return identifierMessage("كود الموظف", values.employeeCode, 64);
}

export function organizationErrorMessage(message: string) {
  if (message.includes("already exists") || message.includes("موجود بالفعل")) return "يوجد سجل بنفس الرمز أو البريد الإلكتروني بالفعل.";
  if (message.includes("رمز القسم") || message.includes('"code"')) return "تحقق من رمز القسم: استخدم حروفًا أو أرقامًا أو مسافات أو شرطات فقط.";
  if (message.includes("كود الموظف") || message.includes('"employeeCode"')) return "تحقق من كود الموظف: استخدم حروفًا أو أرقامًا أو مسافات أو شرطات فقط.";
  return "تعذر حفظ البيانات الآن. راجع الحقول وحاول مرة أخرى.";
}
