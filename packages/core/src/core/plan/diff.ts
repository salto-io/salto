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
  Change,
  ElemID,
  getChangeData,
  InstanceElement,
  isEqualValues,
  isModificationChange,
} from '@salto-io/adapter-api'
import { resolvePath, setPath, walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'

const removePath = (instance: InstanceElement, path: ElemID): void => {
  setPath(instance, path, undefined)
  const parentPath = path.createParentID()
  if (path.nestingLevel > 1 && _.isEmpty(_.pickBy(resolvePath(instance, parentPath), values.isDefined))) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    removePath(instance, parentPath)
  }
}

export const getDiffInstance = (change: Change<InstanceElement>): InstanceElement => {
  const instance = getChangeData(change)

  const diffInstance = instance.clone()

  if (isModificationChange(change)) {
    walkOnElement({
      element: change.data.before,
      func: ({ value, path }) => {
        if (_.isPlainObject(value) || Array.isArray(value)) {
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
