/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  DependencyChange,
  DependencyChanger,
  InstanceElement,
  RemovalChange,
  dependencyChange,
  getChangeData,
  isInstanceChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { deployment } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { getParent, hasValidParent } from '@salto-io/adapter-utils'
import { OBJECT_SCHEMA_TYPE, OBJECT_TYPE_ORDER_TYPE } from '../constants'

type SetId = collections.set.SetId

const createDependencyChange = (objectTypeOrderKey: SetId, objectSchemaKey: SetId): DependencyChange[] => [
  dependencyChange('remove', objectTypeOrderKey, objectSchemaKey),
]

/*
 * This dependency changer is used to remove a dependency from objectTypeOrder to its schema
 * upon removal because the deletion is being pseudo-deleted, with no actual call to the service.
 */
export const objectTypeOrderToSchemaDependencyChanger: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(({ change }) => isRemovalChange(change))
    .filter((change): change is deployment.dependency.ChangeWithKey<RemovalChange<InstanceElement>> =>
      isInstanceChange(change.change),
    )
  const relevantChanges = instanceChanges.filter(change => {
    const instance = getChangeData(change.change)
    return instance.elemID.typeName === OBJECT_TYPE_ORDER_TYPE || instance.elemID.typeName === OBJECT_SCHEMA_TYPE
  })

  const [objectTypeOrderChanges, objectSchemaChanges] = _.partition(
    relevantChanges,
    change => getChangeData(change.change).elemID.typeName === OBJECT_TYPE_ORDER_TYPE,
  )

  if (_.isEmpty(objectTypeOrderChanges) || _.isEmpty(objectSchemaChanges)) {
    return []
  }
  const fullNameToChangeKey = Object.fromEntries(
    objectSchemaChanges.map(({ key, change }) => [getChangeData(change).elemID.getFullName(), key]),
  )
  return objectTypeOrderChanges
    .filter(change => hasValidParent(getChangeData(change.change)))
    .flatMap(change => {
      const objectTypeOrderChange = change as deployment.dependency.ChangeWithKey<RemovalChange<InstanceElement>>
      const parentObjectSchemaKey = fullNameToChangeKey[
        getParent(getChangeData(change.change)).elemID.getFullName()
      ] as SetId
      return parentObjectSchemaKey === undefined
        ? []
        : createDependencyChange(objectTypeOrderChange.key, parentObjectSchemaKey)
    })
}
