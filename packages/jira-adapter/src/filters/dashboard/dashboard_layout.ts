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
  Element,
  AdditionChange,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  isModificationChange,
  ModificationChange,
} from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { safeJsonStringify, inspectValue } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { DASHBOARD_TYPE } from '../../constants'
import JiraClient from '../../client/client'
import { JiraConfig } from '../../config/config'

const log = logger(module)

export type dashboardLayoutsResponse = {
  dashboardLayoutPromise: Promise<
    clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>[] | undefined
  >[]
  instanceToResponse: [InstanceElement, clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>][]
}

export type PromiseInstanceNameToResponse = Promise<
  [InstanceElement, clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>]
>[]

export const deployLayout = async (
  dashboardChange: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const instance = getChangeData(dashboardChange)

  const layoutBefore = isModificationChange(dashboardChange) ? dashboardChange.data.before.value.layout : undefined

  const layoutAfter = instance.value.layout

  if (layoutBefore === layoutAfter || layoutAfter === undefined) {
    return
  }

  const gadgets = isModificationChange(dashboardChange)
    ? // We look on before because this happens before we update the gadgets
      dashboardChange.data.before.value.gadgets ?? []
    : []

  const columns = _(gadgets)
    // If the layout size was reduced, we need to move the gadgets from
    // the removed columns to the last column, and therefore we use the Math.min call
    // (after that in the gadget deployment they will be moved to the right place)
    .groupBy(gadget => Math.min(gadget.value.value.position.column, instance.value.layout.length - 1))
    .map(gadgetGroup =>
      _(gadgetGroup)
        .sortBy(gadget => gadget.value.value.position.row)
        .map(gadget => gadget.value.value.id.toString())
        .value(),
    )
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

export const getDashboardLayoutsAsync = async (
  client: JiraClient,
  config: JiraConfig,
  elements: Element[],
): Promise<PromiseInstanceNameToResponse | undefined> => {
  if (!config.client.usePrivateAPI) {
    log.debug('Skipping dashboard layout filter because private API is not enabled')
    return undefined
  }
  return elements
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === DASHBOARD_TYPE)
    .map(async instance => {
      let response
      try {
        response = await client.get({ url: `/rest/dashboards/1.0/${instance.value.id}` })
      } catch (err) {
        log.warn(
          `Failed to fetch dashboard layout for ${instance.elemID.getFullName()}: ${err}, inspectValue: ${inspectValue(err)}`,
        )
      }
      return [instance, response]
    }) as PromiseInstanceNameToResponse
}

const filter: FilterCreator = ({ adapterContext }) => ({
  name: 'dashboardLayoutFilter',
  onFetch: async () => {
    const promiseInstanceNameToResponse: PromiseInstanceNameToResponse | undefined =
      await adapterContext.dashboardLayoutPromise
    if (promiseInstanceNameToResponse !== undefined) {
      const instanceToResponse = (await Promise.all(promiseInstanceNameToResponse)).filter(
        ([_instance, response]) => response !== undefined,
      )
      instanceToResponse.map(async ([instance, response]) => {
        if (Array.isArray(response.data)) {
          log.error(
            `Invalid response from server when fetching dashboard layout for ${instance.elemID.getFullName()}: ${safeJsonStringify(response.data)}`,
          )
          return
        }
        instance.value.layout = response.data.layout
      })
    }
  },
})

export default filter
