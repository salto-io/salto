/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { types } from '@salto-io/lowerdash'
import { ElemID, SaltoElementError, SeverityLevel } from '@salto-io/adapter-api'
import { ERROR_MESSAGES, inspectValue } from '@salto-io/adapter-utils'

export abstract class MergeError
  extends types.Bean<
    Readonly<{
      elemID: ElemID
      error: string
    }>
  >
  implements SaltoElementError
{
  message = ERROR_MESSAGES.INVALID_NACL_CONTENT

  get detailedMessage(): string {
    return `Error merging ${this.elemID.getFullName()}: ${this.error}`
  }

  public severity: SeverityLevel = 'Error'

  toString(): string {
    return this.message
  }
}

export class DuplicateAnnotationError extends MergeError {
  readonly key: string
  readonly existingValue: unknown
  readonly newValue: unknown

  constructor({
    elemID,
    key,
    existingValue,
    newValue,
  }: {
    elemID: ElemID
    key: string
    existingValue: unknown
    newValue: unknown
  }) {
    super({
      elemID,
      error: `duplicate annotation key ${key} (values - ${inspectValue(existingValue)} & ${inspectValue(newValue)})`,
    })
    this.key = key
    this.existingValue = existingValue
    this.newValue = newValue
  }
}

export type MergeResult<T> = {
  merged: T
  errors: MergeError[]
}

export const mergeNoDuplicates = <T>(
  sources: T[],
  errorCreator: (key: string, existingValue?: unknown, newValue?: unknown) => MergeError,
): MergeResult<T> => {
  const errors: MergeError[] = []
  const merged: unknown = _.mergeWith(
    {},
    ...sources,
    (existingValue: unknown, newValue: unknown, key: string): unknown => {
      if (
        !_.isUndefined(existingValue) &&
        !_.isUndefined(newValue) &&
        !(_.isPlainObject(existingValue) && _.isPlainObject(newValue))
      ) {
        errors.push(errorCreator(key, existingValue, newValue))
        return existingValue
      }
      return undefined
    },
  )
  return { merged: merged as T, errors }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isMergeError = (error: any): error is MergeError => error instanceof MergeError
