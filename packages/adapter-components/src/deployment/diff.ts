/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Change, ElemID, getChangeElement, InstanceElement, isEqualValues, isModificationChange, isReferenceExpression } from '@salto-io/adapter-api'
import { resolvePath, setPath, walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import _ from 'lodash'

const isNumber = (value: string): boolean => !Number.isNaN(Number(value))

const removePath = (instance: InstanceElement, path: ElemID): void => {
  setPath(instance, path, undefined)
  const parentPath = path.createParentID()
  if (path.nestingLevel > 1 && _.isEmpty(resolvePath(instance, parentPath))) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    removePath(instance, parentPath)
  }
}

export const getDiffInstance = (change: Change<InstanceElement>): InstanceElement => {
  const instance = getChangeElement(change)

  const diffInstance = instance.clone()

  if (isModificationChange(change)) {
    walkOnElement({
      element: change.data.before,
      func: ({ value, path }) => {
        const isValueInArray = isNumber(path.getFullNameParts()[path.getFullNameParts().length - 1])
        if (
          (_.isPlainObject(value) && !isReferenceExpression(value))
          // We don't want to remove values from arrays to not create arrays with "holes" in them
          || isValueInArray
        ) {
          return WALK_NEXT_STEP.RECURSE
        }

        const valueAfter = resolvePath(instance, path)

        if (isEqualValues(value, valueAfter)) {
          removePath(diffInstance, path)
          return WALK_NEXT_STEP.SKIP
        }

        return WALK_NEXT_STEP.RECURSE
      },
    })
  }

  return diffInstance
}
