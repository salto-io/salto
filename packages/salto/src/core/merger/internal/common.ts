import _ from 'lodash'
import { types } from '@salto/lowerdash'

import {
  ElemID,
} from 'adapter-api'

export abstract class MergeError extends types.Bean<Readonly<{
  elemID: ElemID
  error: string
}>> {
  get message(): string {
    return `Error merging ${this.elemID.getFullName()}: ${this.error}`
  }

  toString(): string {
    return this.message
  }
}

export type MergeResult<T, TError extends MergeError = MergeError> = Readonly<{
  merged: T
  errors: TError[]
}>

export const mergeNoDuplicates = <T, TError extends MergeError>(
  sources: T[], errorCreator: (key: string) => TError
): MergeResult<T, TError> => {
  const errors: TError[] = []
  const merged: unknown = _.mergeWith(
    {},
    ...sources,
    (existingValue: unknown, _s: unknown, key: string): unknown => {
      if (existingValue !== undefined) {
        errors.push(errorCreator(key))
        return existingValue
      }
      return undefined
    }
  )
  return { merged: merged as T, errors }
}
