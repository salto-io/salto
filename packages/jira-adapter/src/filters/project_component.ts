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
import { Change, Element, getChangeData, InstanceElement, isInstanceChange, isInstanceElement, isRemovalChange } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { defaultDeployChange, deployChanges } from '../deployment/standard_deployment'
import { FilterCreator } from '../filter'

const PROJECT_COMPONENT_TYPE_NAME = 'ProjectComponent'

const log = logger(module)

const filter: FilterCreator = ({ client, config }) => ({
  name: 'projectComponentFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_COMPONENT_TYPE_NAME)
      .forEach(instance => {
        const leadAccountId = client.isDataCenter ? instance.value.lead?.key : instance.value.lead?.accountId
        if (leadAccountId !== undefined) {
          instance.value.leadAccountId = leadAccountId
          delete instance.value.lead
        }
      })
  },

  preDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === PROJECT_COMPONENT_TYPE_NAME)
      .forEach(instance => {
        const projectKey = getParents(instance)[0]?.value?.value?.key
        if (projectKey !== undefined) {
          instance.value.project = projectKey
        }
        if (client.isDataCenter) {
          instance.value.leadUserName = instance.value.leadAccountId
          delete instance.value.leadAccountId
        }
      })
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === PROJECT_COMPONENT_TYPE_NAME
        && isRemovalChange(change)
    )


    const deployResult = await deployChanges(
      relevantChanges as Change<InstanceElement>[],
      async change => {
        try {
          await defaultDeployChange({
            change,
            client,
            apiDefinitions: config.apiDefinitions,
          })
        } catch (err) {
          if (err instanceof clientUtils.HTTPError
            && Array.isArray(err.response.data.errorMessages)
            && err.response.data.errorMessages
              .includes(`The component with id ${getChangeData(change).value.id} does not exist.`)
          ) {
            log.debug(`When attempting to delete component ${getChangeData(change).elemID.getFullName}, received an error that it is already deleted`)
            return
          }
          throw err
        }
      }
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },

  onDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === PROJECT_COMPONENT_TYPE_NAME)
      .forEach(instance => {
        delete instance.value.project
        if (client.isDataCenter) {
          instance.value.leadAccountId = instance.value.leadUserName
          delete instance.value.leadUserName
        }
      })
  },
})

export default filter
