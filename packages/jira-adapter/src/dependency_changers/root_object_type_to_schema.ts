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
import { OBJECT_SCHEMA_TYPE, OBJECT_TYPE_TYPE } from '../constants'

const createDependencyChange = (
  objectTypeChange: deployment.dependency.ChangeWithKey<RemovalChange<InstanceElement>>,
  objectSchemaChange: deployment.dependency.ChangeWithKey<RemovalChange<InstanceElement>>,
): DependencyChange[] => [dependencyChange('remove', objectTypeChange.key, objectSchemaChange.key)]

/*
 * This dependency changer is used to remove a dependency from root object type to it's schema
 * upon removal because we added the reference for Salto's internal use. but no real dependency exists
 * In this direction. We also have parent annotation that is used for the real dependency.
 */
export const rootObjectTypeToObjectSchemaDependencyChanger: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(({ change }) => isRemovalChange(change))
    .filter((change): change is deployment.dependency.ChangeWithKey<RemovalChange<InstanceElement>> =>
      isInstanceChange(change.change),
    )
  const relevantChanges = instanceChanges.filter(change => {
    const instance = getChangeData(change.change)
    if (instance.elemID.typeName === OBJECT_SCHEMA_TYPE) {
      return true
    }
    return (
      instance.elemID.typeName === OBJECT_TYPE_TYPE &&
      instance.value.parentObjectTypeId?.elemID.typeName === OBJECT_SCHEMA_TYPE
    )
  })

  const [objectTypeChanges, objectSchemaChanges] = _.partition(
    relevantChanges,
    change => getChangeData(change.change).elemID.typeName === OBJECT_TYPE_TYPE,
  )

  if (_.isEmpty(objectTypeChanges) || _.isEmpty(objectSchemaChanges)) {
    return []
  }
  return objectTypeChanges.flatMap(change => {
    const objectTypeChange = change as deployment.dependency.ChangeWithKey<RemovalChange<InstanceElement>>
    return objectSchemaChanges
      .map(objectSchemaChange => createDependencyChange(objectTypeChange, objectSchemaChange))
      .flat()
  })
}
