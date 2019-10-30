export class ValidationError extends Error {}

export const validateOneOf = <V, T extends V>(
  list: ReadonlyArray<T>, typeName: string, v: V
): T => {
  if (!list.includes(v as T)) {
    throw new ValidationError(`Invalid ${typeName} "${v}", expected one of: ${list}`)
  }
  return v as T
}
