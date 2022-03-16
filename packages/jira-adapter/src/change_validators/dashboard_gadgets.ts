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
import { ChangeValidator, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, SeverityLevel } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { DASHBOARD_GADGET_TYPE } from '../constants'

const { awu } = collections.asynciterable

export const getGadgetKey = (instance: InstanceElement): string =>
  `${getParents(instance)[0].elemID.name}-${instance.value.position.row}-${instance.value.position.column}`

export const dashboardGadgetsValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    return []
  }

  const gadgetsMap = _.groupBy(
    await awu(await elementsSource.list())
      .filter(id => id.typeName === DASHBOARD_GADGET_TYPE && id.idType === 'instance')
      .map(id => elementsSource.get(id))
      .toArray(),
    getGadgetKey,
  )


  return awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === DASHBOARD_GADGET_TYPE)
    .filter(instance => gadgetsMap[getGadgetKey(instance)]?.length > 1)
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Two gadgets of the same dashboard cannot have the same position',
      detailedMessage: `The position of the gadget ${instance.elemID.getFullName()} is already taken by another gadget in the same dashboard`,
    }))
    .toArray()
}
