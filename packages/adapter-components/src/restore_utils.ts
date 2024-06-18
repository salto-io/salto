/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  GetLookupNameFunc,
  transformElement,
  TransformFunc,
  WALK_NEXT_STEP,
  walkOnElement,
  WalkOnFunc,
} from '@salto-io/adapter-utils'
import {
  Change,
  compareSpecialValues,
  getChangeData,
  isAdditionChange,
  isElement,
  isModificationChange,
  isReferenceExpression,
  isRemovalChange,
  isStaticFile,
  ReferenceExpression,
  StaticFile,
  Value,
  Element,
  isTemplateExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { parserUtils } from '@salto-io/parser'
import _, { isBuffer, isString } from 'lodash'

const log = logger(module)

export type RestoreValuesFunc = <T extends Element>(
  source: T,
  targetElement: T,
  getLookUpName: GetLookupNameFunc,
  allowEmpty?: boolean,
) => Promise<T>

// The following function handles comparing values that may contain elements
// this can happen after "resolveValues" if the getLookupName function returns elements
// we still treat these elements as if they are references, meaning we only care if
// the element ID is the same
const isEqualResolvedValues = (first: Value, second: Value): boolean =>
  _.isEqualWith(first, second, (firstVal, secondVal) => {
    if (isElement(first) || isElement(second)) {
      if (isElement(first) && isElement(second)) {
        return first.elemID.isEqual(second.elemID)
      }
      // If only one side is an element, they are not equal
      return false
    }
    return compareSpecialValues(firstVal, secondVal)
  })

export const restoreValues: RestoreValuesFunc = async (source, targetElement, getLookUpName, allowEmpty = true) => {
  const allReferencesPaths = new Map<string, ReferenceExpression>()
  const allStaticFilesPaths = new Map<string, StaticFile>()
  const createPathMapCallback: WalkOnFunc = ({ value, path }) => {
    if (isReferenceExpression(value)) {
      allReferencesPaths.set(path.getFullName(), value)
      return WALK_NEXT_STEP.SKIP
    }
    if (isStaticFile(value)) {
      allStaticFilesPaths.set(path.getFullName(), value)
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }

  walkOnElement({ element: source, func: createPathMapCallback })
  const restoreValuesFunc: TransformFunc = async ({ value, field, path }) => {
    if (path === undefined) {
      return value
    }

    if (isReferenceExpression(value) || isStaticFile(value)) {
      // The value is already "restored", nothing to do
      return value
    }

    const ref = allReferencesPaths.get(path.getFullName())
    if (ref !== undefined) {
      const refValue = await getLookUpName({ ref, field, path, element: targetElement })
      if (isEqualResolvedValues(refValue, value)) {
        return ref
      }
    }

    const file = allStaticFilesPaths.get(path.getFullName())
    if (file !== undefined) {
      if (file.isTemplate && isTemplateExpression(value)) {
        return parserUtils.templateExpressionToStaticFile(value, file.filepath)
      }
      if (isBuffer(value) || isString(value)) {
        const content = file.encoding === 'binary' || isBuffer(value) ? value : Buffer.from(value, file.encoding)
        return new StaticFile({ filepath: file.filepath, content, encoding: file.encoding })
      }
    }
    return value
  }

  return transformElement({
    element: targetElement,
    transformFunc: restoreValuesFunc,
    strict: false,
    allowEmptyArrays: allowEmpty,
    allowEmptyObjects: allowEmpty,
  })
}

export const restoreChangeElement = async (
  change: Change,
  sourceChanges: Record<string, Change>,
  getLookUpName: GetLookupNameFunc,
  restoreValuesFunc = restoreValues,
): Promise<Change> => {
  // We only need to restore the "after" part. "before" could not have changed so we can just use
  // the "before" from the source change
  const sourceChange = sourceChanges[getChangeData(change).elemID.getFullName()]
  if (isRemovalChange(change) && isRemovalChange(sourceChange)) {
    return sourceChange
  }
  const restoredAfter = await restoreValuesFunc(getChangeData(sourceChange), getChangeData(change), getLookUpName)
  if (isModificationChange(change) && isModificationChange(sourceChange)) {
    return {
      ...change,
      data: {
        before: sourceChange.data.before,
        after: restoredAfter,
      },
    }
  }
  if (isAdditionChange(change) && isAdditionChange(sourceChange)) {
    return {
      ...change,
      data: {
        after: restoredAfter,
      },
    }
  }
  // We should never get here, but if there is a mis-match between the source change and the change
  // we got, we warn and return the change we got without restoring
  log.warn(
    'Could not find matching source change for %s, change type %s, source type %s',
    getChangeData(change).elemID.getFullName(),
    change.action,
    sourceChange.action,
  )
  return change
}
