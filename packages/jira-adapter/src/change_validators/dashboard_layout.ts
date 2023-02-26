/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ChangeValidator, getChangeData, isInstanceChange, isInstanceElement, isModificationChange, isReferenceExpression, ReferenceExpression, SeverityLevel } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { DASHBOARD_TYPE } from '../constants'

const { awu } = collections.asynciterable

export const dashboardLayoutValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => change.data.before.value.layout !== change.data.after.value.layout
      && change.data.after.value.layout !== undefined)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === DASHBOARD_TYPE)
    .map(instance => {
      const invalidGadgets = (instance.value.gadgets ?? [])
        .filter(isReferenceExpression)
        .filter((gadget: ReferenceExpression) => isInstanceElement(gadget.value))
        .filter((gadget: ReferenceExpression) =>
          gadget.value.value.position.column >= instance.value.layout.length)

      if (invalidGadgets.length === 0) {
        return undefined
      }

      return {
        elemID: instance.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Dashboard gadget positions are out of bounds',
        detailedMessage: `This dashboard has gadgets with a column position which exceeds the number of columns (${instance.value.layout.length}) in the ${instance.value.layout} layout: ${invalidGadgets.map((gadget: ReferenceExpression) => gadget.elemID.name).join(', ')}. Please change the layout or re-position the gadgets to deploy this dashboard.`,
      }
    })
    .filter(values.isDefined)
    .toArray()
