/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { InstanceElement, ElemID, TypeReference, ObjectType } from '@salto-io/adapter-api'
import { inspectValue } from '@salto-io/adapter-utils'
import { MergeResult, MergeError, mergeNoDuplicates, DuplicateAnnotationError } from './common'

export class DuplicateInstanceKeyError extends MergeError {
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
      error: `duplicate key ${key} (values - ${inspectValue(existingValue)} & ${inspectValue(newValue)})`,
    })
    this.key = key
    this.existingValue = existingValue
    this.newValue = newValue
  }
}

const mergeInstanceDefinitions = (
  { elemID, refType }: { elemID: ElemID; refType: TypeReference<ObjectType> },
  instanceDefs: InstanceElement[],
): MergeResult<InstanceElement> => {
  const valueMergeResult =
    instanceDefs.length > 1
      ? mergeNoDuplicates(
          instanceDefs.map(i => i.value),
          (key, existingValue, newValue) => new DuplicateInstanceKeyError({ elemID, key, existingValue, newValue }),
        )
      : {
          merged: instanceDefs[0].value,
          errors: [],
        }

  const annotationsMergeResults = mergeNoDuplicates(
    instanceDefs.map(o => o.annotations),
    (key, existingValue, newValue) => new DuplicateAnnotationError({ elemID, key, existingValue, newValue }),
  )

  return {
    merged: new InstanceElement(
      elemID.name,
      refType,
      valueMergeResult.merged,
      undefined,
      annotationsMergeResults.merged,
    ),
    errors: [...valueMergeResult.errors, ...annotationsMergeResults.errors],
  }
}

export const mergeInstances = (instances: InstanceElement[]): MergeResult<InstanceElement> =>
  mergeInstanceDefinitions(instances[0], instances)
