import { BackendError } from "../../custom"

interface MessageHolder {
  message: string
}

// BackendError type guard
export function isBackEndError(err: unknown): err is BackendError {
  return (
    typeof err === "object" &&
    err !== null &&
    ("simpleError" in err || "complexError" in err || "unknownError" in err)
  )
}

// Type guard for ensuring that a given object has a "message" property
export function hasMessage(err: unknown): err is MessageHolder {
  return (typeof err === "object" && err !== null && "message" in err)
}

// Postgres Errors
interface PostgresErr {
  code: string
}

// Returns true if the given error is a valid postgres error and false otherwise
export function ensureValidPostgresErr(err: unknown): err is PostgresErr {
  return (!!err && typeof err === "object" && "code" in err && typeof (err as PostgresErr).code === "string")
}