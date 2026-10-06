export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const isUniqueViolation = (e: unknown): boolean => {
  const err = e as { code?: string; message?: string };
  return (
    err?.code === "ER_DUP_ENTRY" ||
    /UNIQUE constraint failed/i.test(err?.message ?? "") ||
    /Duplicate entry/i.test(err?.message ?? "")
  );
};

export const isOptimisticLock = (e: unknown): boolean => {
  const name = (e as { name?: string })?.name ?? "";
  return name === "OptimisticLockVersionMismatchError" || /OptimisticLock/.test(name);
};
