/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  dependencyChange,
  DependencyChanger,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  DependencyChange,
  isRemovalChange,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { GUIDE_ORDER_TYPES } from '../filters/guide_order/guide_order_utils'
import { CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME } from '../constants'

const createDependencyChange = (
  orderChange: { key: collections.set.SetId; change: Change<InstanceElement> },
  changes: { key: collections.set.SetId; change: Change<InstanceElement> }[],
): DependencyChange[] => {
  const orderParent = getChangeData(orderChange.change).annotations[CORE_ANNOTATIONS.PARENT][0]

  const parentChanges = changes.filter(change => getChangeData(change.change).elemID === orderParent.value.elemID)

  return parentChanges.map(parentChange => dependencyChange('remove', orderChange.key, parentChange.key))
}

const isRelevantOrderChange = (change: Change<InstanceElement>): boolean =>
  isRemovalChange(change) &&
  isInstanceChange(change) &&
  [...GUIDE_ORDER_TYPES, CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME].includes(change.data.before.elemID.typeName)

/**
 * Removed the dependency between an order instance and its parent, to avoid circular dependency
 */
export const orderDependencyChanger: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
      isInstanceChange(change.change),
    )

  const relevantOrderChanges = instanceChanges.filter(({ change }) => isRelevantOrderChange(change))

  return relevantOrderChanges.flatMap(change => createDependencyChange(change, instanceChanges))
}
