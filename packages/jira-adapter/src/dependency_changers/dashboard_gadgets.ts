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
