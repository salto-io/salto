/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { collections } from '@salto-io/lowerdash'
import { deployment } from '@salto-io/adapter-components'
import { OBJECT_TYPE_TYPE } from '../constants'

type SetId = collections.set.SetId
type RemovalInstanceChangeWithKey = deployment.dependency.ChangeWithKey<RemovalChange<InstanceElement>>

/*
 * This dependency changer is used to reverse the dependency between object types and their non salto parent on removal.
 * This way the behavior will be the same as in salto's parents. Without it a cycle will be created with the order object
 */
export const objectTypeParentDependencyChanger: DependencyChanger = async changes => {
  const objectTypeChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(({ change }) => isRemovalChange(change))
    .filter(({ change }) => getChangeData(change).elemID.typeName === OBJECT_TYPE_TYPE)
    .filter((change): change is RemovalInstanceChangeWithKey => isInstanceChange(change.change))

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
