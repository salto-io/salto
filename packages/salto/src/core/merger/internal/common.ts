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

export type MergeResult<T> = {
  merged: T
  errors: MergeError[]
}

export const mergeNoDuplicates = <T>(
  sources: T[], errorCreator: (key: string) => MergeError
): MergeResult<T> => {
  const errors: MergeError[] = []
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
