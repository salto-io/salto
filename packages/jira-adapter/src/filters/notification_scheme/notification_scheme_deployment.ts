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
import { Element, getChangeData, isAdditionOrModificationChange, isInstanceChange, isRemovalChange, isRemovalOrModificationChange } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { findObject, setFieldDeploymentAnnotations, setTypeDeploymentAnnotations } from '../../utils'
import { FilterCreator } from '../../filter'
import { deployWithJspEndpoints } from '../../deployment/jsp_deployment'
import { NOTIFICATION_EVENT_TYPE_NAME, NOTIFICATION_SCHEME_TYPE_NAME } from '../../constants'
import { deployChanges } from '../../deployment/standard_deployment'
import { deployEvents } from './notification_events'

const { awu } = collections.asynciterable

const log = logger(module)


const filter: FilterCreator = ({ client, config, paginator }) => ({
  name: 'notificationSchemeDeploymentFilter',
  onFetch: async (elements: Element[]) => {
    if (!config.client.usePrivateAPI) {
      log.debug('Skipping notification scheme deployment filter because private API is not enabled')
      return
    }

    const notificationSchemeType = findObject(elements, NOTIFICATION_SCHEME_TYPE_NAME)
    if (notificationSchemeType !== undefined) {
      setTypeDeploymentAnnotations(notificationSchemeType)
      setFieldDeploymentAnnotations(notificationSchemeType, 'id')
      setFieldDeploymentAnnotations(notificationSchemeType, 'name')
      setFieldDeploymentAnnotations(notificationSchemeType, 'description')
      setFieldDeploymentAnnotations(notificationSchemeType, 'notificationSchemeEvents')
    }

    const notificationEventType = findObject(elements, NOTIFICATION_EVENT_TYPE_NAME)
    if (notificationEventType !== undefined) {
      setFieldDeploymentAnnotations(notificationEventType, 'eventType')
      setFieldDeploymentAnnotations(notificationEventType, 'notifications')
    }
  },

  deploy: async changes => {
    if (client.isDataCenter) {
      return {
        leftoverChanges: changes,
        deployResult: {
          appliedChanges: [],
          errors: [],
        },
      }
    }
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === NOTIFICATION_SCHEME_TYPE_NAME
    )

    const jspRequests = config.apiDefinitions.types[NOTIFICATION_SCHEME_TYPE_NAME]?.jspRequests
    if (jspRequests === undefined) {
      throw new Error(`${NOTIFICATION_SCHEME_TYPE_NAME} jsp urls are missing from the configuration`)
    }

    const requestConfig = config.apiDefinitions.types.NotificationSchemes.request
    if (requestConfig === undefined) {
      throw new Error(`${NOTIFICATION_SCHEME_TYPE_NAME} is missing request config`)
    }

    const deployResult = await deployWithJspEndpoints({
      changes: relevantChanges.filter(isInstanceChange),
      client,
      urls: jspRequests,
      queryFunction: async () => awu(paginator(
        requestConfig,
        page => collections.array.makeArray(page.values) as clientUtils.ResponseValue[]
      )).flat().toArray(),
      serviceValuesTransformer: serviceValues => ({
        ...serviceValues,
        schemeId: serviceValues.id,
      }),
      fieldsToIgnore: [
        'notificationSchemeEvents',
      ],
    })

    const eventsDeployResult = await deployChanges(
      deployResult.appliedChanges
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange),

      change => deployEvents(
        change,
        client,
        config,
      )
    )

    return {
      leftoverChanges,
      deployResult: {
        appliedChanges: [
          ...deployResult.appliedChanges.filter(isRemovalChange),
          ...eventsDeployResult.appliedChanges,
        ],
        errors: [
          ...deployResult.errors,
          ...eventsDeployResult.errors,
        ],
      },
    }
  },

  preDeploy: async changes => {
    if (client.isDataCenter) {
      return
    }
    changes
      .filter(isInstanceChange)
      .filter(isRemovalOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === NOTIFICATION_SCHEME_TYPE_NAME)
      .forEach(instance => {
        instance.value.schemeId = instance.value.id
      })
  },

  onDeploy: async changes => {
    if (client.isDataCenter) {
      return
    }
    changes
      .filter(isInstanceChange)
      .filter(isRemovalOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === NOTIFICATION_SCHEME_TYPE_NAME)
      .forEach(instance => {
        delete instance.value.schemeId
      })
  },
})

export default filter
