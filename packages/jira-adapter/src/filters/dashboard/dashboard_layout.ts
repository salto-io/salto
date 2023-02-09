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
import { AdditionChange, getChangeData, InstanceElement, isInstanceElement, isModificationChange, ModificationChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { DASHBOARD_TYPE } from '../../constants'
import JiraClient from '../../client/client'

const log = logger(module)

export const deployLayout = async (
  dashboardChange: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient
): Promise<void> => {
  const instance = getChangeData(dashboardChange)

  const layoutBefore = isModificationChange(dashboardChange)
    ? dashboardChange.data.before.value.layout
    : undefined

  const layoutAfter = instance.value.layout

  if (layoutBefore === layoutAfter || layoutAfter === undefined) {
    return
  }

  const gadgets = isModificationChange(dashboardChange)
    // We look on before because this happens before we update the gadgets
    ? dashboardChange.data.before.value.gadgets ?? []
    : []

  const columns = _(gadgets)
    // If the layout size was reduced, we need to move the gadgets from
    // the removed columns to the last column, and therefore we use the Math.min call
    // (after that in the gadget deployment they will be moved to the right place)
    .groupBy(gadget => Math.min(
      gadget.value.value.position.column,
      instance.value.layout.length - 1
    ))
    .map(gadgetGroup => _(gadgetGroup)
      .sortBy(gadget => gadget.value.value.position.row)
      .map(gadget => gadget.value.value.id.toString())
      .value())
    .value()

  await client.putPrivate({
    url: `/rest/dashboards/1.0/${instance.value.id}/layout`,
    data: {
      layout: instance.value.layout,
      0: columns[0] ?? [],
      1: columns[1] ?? [],
      2: columns[2] ?? [],
    },
  })
}

const filter: FilterCreator = ({ client, config }) => ({
  name: 'dashboardLayoutFilter',
  onFetch: async elements => {
    if (!config.client.usePrivateAPI) {
      log.debug('Skipping dashboard layout filter because private API is not enabled')
      return
    }

    await Promise.all(elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === DASHBOARD_TYPE)
      .map(async instance => {
        const response = await client.getSinglePage({
          url: `/rest/dashboards/1.0/${instance.value.id}`,
        })
        if (Array.isArray(response.data)) {
          log.error(`Invalid response from server when fetching dashboard layout for ${instance.elemID.getFullName()}: ${safeJsonStringify(response.data)}`)
          return
        }
        instance.value.layout = response.data.layout
      }))
  },
})

export default filter
