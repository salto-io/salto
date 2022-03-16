/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Change, dependencyChange, DependencyChanger, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { DASHBOARD_GADGET_TYPE, DASHBOARD_TYPE } from '../constants'


export const dashboardGadgetsDependencyChanger: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(
      (change): change is { key: collections.set.SetId; change: Change<InstanceElement> } =>
        isInstanceChange(change.change)
    )

  const gadgetChanges = instanceChanges
    .filter(({ change }) => getChangeData(change).elemID.typeName === DASHBOARD_GADGET_TYPE)

  const dashboardChanges = instanceChanges
    .filter(({ change }) => getChangeData(change).elemID.typeName === DASHBOARD_TYPE)

  const idToDashboardChange = _.keyBy(
    dashboardChanges,
    ({ change }) => getChangeData(change).elemID.getFullName()
  )

  const gadgetToDashboardDeps = gadgetChanges
    .filter(({ change }) => getParents(getChangeData(change))[0].elemID.getFullName()
      in idToDashboardChange)
    .flatMap(({ change, key }) => [
      dependencyChange(
        'add',
        key,
        idToDashboardChange[getParents(getChangeData(change))[0].elemID.getFullName()].key,
      ),
      dependencyChange(
        'remove',
        idToDashboardChange[getParents(getChangeData(change))[0].elemID.getFullName()].key,
        key,
      ),
    ])

  const gadgetsToGadgetsDeps = gadgetChanges
    .filter(({ change }) => isAdditionOrModificationChange(change))
    .flatMap(({ key, change }) => {
      const instance = getChangeData(change)
      const deps = gadgetChanges.filter(({ change: gadgetChange }) => {
        const gadgetInstance = getChangeData(gadgetChange)
        return getParents(gadgetInstance)[0].elemID.isEqual(getParents(instance)[0].elemID)
          && instance.value.position.column === gadgetInstance.value.position.column
          && instance.value.position.row > gadgetInstance.value.position.row
      })

      return deps.map(
        dep => dependencyChange(
          'add',
          key,
          dep.key,
        )
      )
    })

  return [...gadgetToDashboardDeps, ...gadgetsToGadgetsDeps]
}
