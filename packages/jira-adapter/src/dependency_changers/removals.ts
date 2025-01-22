/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  CORE_ANNOTATIONS,
  dependencyChange,
  DependencyChanger,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isRemovalChange,
  RemovalChange,
} from '@salto-io/adapter-api'
import { references } from '@salto-io/adapter-utils'
import { deployment } from '@salto-io/adapter-components'
import _ from 'lodash'
import { FIELD_CONTEXT_TYPE_NAME } from '../filters/fields/constants'
import { OBJECT_TYPE_TYPE } from '../constants'

const TYPES_TO_IGNORE = [FIELD_CONTEXT_TYPE_NAME, OBJECT_TYPE_TYPE]

export const removalsDependencyChanger: DependencyChanger = async changes => {
  const removalsChanges = _(Array.from(changes.entries()))
    .map(([key, change]) => ({ key, change }))
    .filter(
      (change): change is deployment.dependency.ChangeWithKey<RemovalChange<InstanceElement>> =>
        isInstanceChange(change.change) &&
        isRemovalChange(change.change) &&
        !TYPES_TO_IGNORE.includes(getChangeData(change.change).elemID.typeName),
    )
    .keyBy(({ change }) => getChangeData(change).elemID.getFullName())
    .value()

  return Array.from(changes.entries()).flatMap(([destKey, change]) => {
    if (isAdditionChange(change)) {
      return []
    }

    const referencedKeys = references
      .getReferences(change.data.before)
      .filter(({ path }) => !path.getFullNameParts().includes(CORE_ANNOTATIONS.PARENT))
      .map(({ value }) => value.elemID.createTopLevelParentID().parent.getFullName())
      .filter(id => id in removalsChanges)
      .map(id => removalsChanges[id])
      .map(({ key }) => key)
      .filter(key => key !== destKey)

    return referencedKeys.map(sourceKey => dependencyChange('add', sourceKey, destKey))
  })
}
