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
  DependencyChanger,
  InstanceElement,
  RemovalChange,
  dependencyChange,
  getChangeData,
  isInstanceChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { deployment } from '@salto-io/adapter-components'
import { OBJECT_TYPE_TYPE } from '../constants'

type SetId = collections.set.SetId
type RemovalInstanceChangeWithKey = deployment.dependency.ChangeWithKey<RemovalChange<InstanceElement>>

/*
 * This dependency changer is used to reverse the dependency between object types and their non salto parent on removal.
 * This way the behavior will be the same as in salto's parents. Without it a cycle will be created with the order object
 */
export const objectTypeParentReversalDependencyChanger: DependencyChanger = async changes => {
  const objectTypeChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(({ change }) => isRemovalChange(change))
    .filter(({ change }) => getChangeData(change).elemID.typeName === OBJECT_TYPE_TYPE)
    .filter((change): change is RemovalInstanceChangeWithKey => isInstanceChange(change.change))

  if (_.isEmpty(objectTypeChanges)) {
    return []
  }
  const fullNameToChangeKey = Object.fromEntries(
    objectTypeChanges.map(({ key, change }) => [getChangeData(change).elemID.getFullName(), key]),
  )
  return objectTypeChanges
    .filter(({ change }) => getChangeData(change).value.parentObjectTypeId?.elemID?.typeName === OBJECT_TYPE_TYPE)
    .flatMap(({ change, key }) => {
      const parentObjectTypeKey = fullNameToChangeKey[
        getChangeData(change).value.parentObjectTypeId.elemID.getFullName()
      ] as SetId

      return parentObjectTypeKey === undefined
        ? []
        : [dependencyChange('add', key, parentObjectTypeKey), dependencyChange('remove', parentObjectTypeKey, key)]
    })
}
