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
import { AdditionChange, CORE_ANNOTATIONS, Element, getChangeData, InstanceElement, isInstanceElement, isModificationChange, ModificationChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import { resolveChangeElement, createSchemeGuard } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { BOARD_ESTIMATION_TYPE, BOARD_TYPE_NAME } from '../../constants'
import { addAnnotationRecursively, findObject, setFieldDeploymentAnnotations } from '../../utils'
import JiraClient from '../../client/client'
import { getLookUpName } from '../../reference_mapping'


const log = logger(module)

type TimeTrackingResponse = {
  currentTrackingStatistic: {
    fieldId?: string
  }
}

const TIME_TRACKING_RESPONSE_SCHEME = Joi.object({
  currentTrackingStatistic: Joi.object({
    fieldId: Joi.string().optional(),
  }).unknown(true).required(),
}).unknown(true).required()

const isTimeTrackingResponse = createSchemeGuard<TimeTrackingResponse>(TIME_TRACKING_RESPONSE_SCHEME, 'Received invalid time tracking result')

const getTimeTracking = async (
  instance: InstanceElement,
  client: JiraClient,
): Promise<string | undefined> => {
  const response = await client.getSinglePage({
    url: `/rest/greenhopper/1.0/rapidviewconfig/estimation?rapidViewId=${instance.value.id}`,
  })

  if (!isTimeTrackingResponse(response.data)) {
    log.error(`Failed to get time tracking information for instance ${instance.elemID.getFullName()}`)
    return undefined
  }

  return response.data.currentTrackingStatistic.fieldId
}

export const deployEstimation = async (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const resolvedChange = await resolveChangeElement(change, getLookUpName)

  if ((
    isModificationChange(resolvedChange)
      && _.isEqual(
        resolvedChange.data.before.value.estimation,
        resolvedChange.data.after.value.estimation,
      )
  ) || getChangeData(resolvedChange).value.estimation === undefined) {
    return
  }

  const instance = getChangeData(resolvedChange)

  await client.putPrivate({
    url: '/rest/greenhopper/1.0/rapidviewconfig/estimation',
    data: {
      rapidViewId: instance.value.id,
      estimateStatisticId: `field_${instance.value.estimation.field}`,
      trackingStatisticId: instance.value.estimation.timeTracking !== undefined
        ? `field_${instance.value.estimation.timeTracking}`
        : 'none_',
    },
  })
}

const filter: FilterCreator = ({ config, client }) => ({
  name: 'boardEstimationFilter',
  onFetch: async (elements: Element[]) => {
    const boardInstances = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === BOARD_TYPE_NAME)
      .filter(instance => instance.value.config?.estimation !== undefined)

    boardInstances.forEach(instance => {
      instance.value.estimation = instance.value.config.estimation
      delete instance.value.config.estimation

      instance.value.estimation.field = instance.value.estimation.field.fieldId
    })

    if (!config.client.usePrivateAPI) {
      log.debug('Skipping board estimation filter because private API is not enabled')
      return
    }

    await Promise.all(boardInstances.map(async instance => {
      instance.value.estimation.timeTracking = await getTimeTracking(instance, client)
    }))

    const estimationType = findObject(elements, BOARD_ESTIMATION_TYPE)
    const boardType = findObject(elements, BOARD_TYPE_NAME)

    if (estimationType === undefined || boardType === undefined) {
      return
    }

    setFieldDeploymentAnnotations(boardType, 'estimation')
    await addAnnotationRecursively(estimationType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(estimationType, CORE_ANNOTATIONS.UPDATABLE)
  },
})

export default filter
