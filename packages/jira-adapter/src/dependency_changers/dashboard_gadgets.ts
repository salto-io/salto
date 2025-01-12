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
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { deployment } from '@salto-io/adapter-components'
import { getGadgetInstanceKey, getGadgetKey } from '../change_validators/dashboard_gadgets'
import { DASHBOARD_GADGET_TYPE, DASHBOARD_TYPE } from '../constants'

export const dashboardGadgetsDependencyChanger: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
      isInstanceChange(change.change),
    )

  const gadgetChanges = instanceChanges.filter(
    ({ change }) => getChangeData(change).elemID.typeName === DASHBOARD_GADGET_TYPE,
  )

  const dashboardChanges = instanceChanges.filter(
    ({ change }) => getChangeData(change).elemID.typeName === DASHBOARD_TYPE,
  )

  const idToDashboardChange = _.keyBy(dashboardChanges, ({ change }) => getChangeData(change).elemID.getFullName())

  const gadgetToDashboardDeps = gadgetChanges
    .filter(({ change }) => getParents(getChangeData(change))[0]?.elemID.getFullName() in idToDashboardChange)
    .flatMap(({ change, key }) => [
      dependencyChange('add', key, idToDashboardChange[getParents(getChangeData(change))[0].elemID.getFullName()].key),
      dependencyChange(
        'remove',
        idToDashboardChange[getParents(getChangeData(change))[0].elemID.getFullName()].key,
        key,
      ),
    ])

  const gadgetsMap = _.keyBy(gadgetChanges, ({ change }) => getGadgetInstanceKey(getChangeData(change)))

  const gadgetsToGadgetsDeps = gadgetChanges
    .filter(({ change }) => isAdditionOrModificationChange(change))
    .flatMap(({ key, change }) => {
      const instance = getChangeData(change)
      const deps = _.range(0, instance.value.position.row)
        .map(row => gadgetsMap[getGadgetKey(getParents(instance)[0].elemID, row, instance.value.position.column)])
        .filter(values.isDefined)

      return deps.map(dep => dependencyChange('add', key, dep.key))
    })

  return [...gadgetToDashboardDeps, ...gadgetsToGadgetsDeps]
}
