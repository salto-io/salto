/*
 * Copyright 2025 Salto Labs Ltd.
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
import _ from 'lodash'
import { deployment } from '@salto-io/adapter-components'
import { getParent, hasValidParent } from '@salto-io/adapter-utils'
import { OBJECT_SCHEMA_TYPE, OBJECT_TYPE_ORDER_TYPE } from '../constants'

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
      const parentObjectSchemaKey = fullNameToChangeKey[getParent(getChangeData(change.change)).elemID.getFullName()]
      return parentObjectSchemaKey === undefined ? [] : dependencyChange('remove', change.key, parentObjectSchemaKey)
    })
}
