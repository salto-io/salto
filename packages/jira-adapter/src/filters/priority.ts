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
import { CORE_ANNOTATIONS, Element, getChangeData, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { findObject, setDeploymentAnnotations } from '../utils'
import { FilterCreator } from '../filter'
import { deployWithJspEndpoints } from '../deployment/jsp_deployment'
import { PRIORITY_TYPE_NAME } from '../constants'
import { JspUrls } from '../config'

const log = logger(module)

const filter: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]) => {
    if (!config.client.usePrivateAPI) {
      log.debug('Skipping priority filter because private API is not enabled')
      return
    }

    const priorityType = findObject(elements, PRIORITY_TYPE_NAME)
    if (priorityType === undefined) {
      log.warn(`${PRIORITY_TYPE_NAME} type not found, skipping priority filter`)
      return
    }

    priorityType.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    priorityType.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
    setDeploymentAnnotations(priorityType, 'id')
    setDeploymentAnnotations(priorityType, 'statusColor')
    setDeploymentAnnotations(priorityType, 'description')
    setDeploymentAnnotations(priorityType, 'iconUrl')
    setDeploymentAnnotations(priorityType, 'name')
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isAdditionOrModificationChange(change)
        && getChangeData(change).elemID.typeName === PRIORITY_TYPE_NAME
    )

    const deployResult = await deployWithJspEndpoints({
      changes: relevantChanges.filter(isInstanceChange).filter(isAdditionOrModificationChange),
      client,
      urls: config.apiDefinitions.types[PRIORITY_TYPE_NAME].jspRequests as JspUrls,
      serviceValuesTransformer: serviceValues => _.omit({
        ...serviceValues,
        iconurl: new URL(serviceValues.iconUrl).pathname,
      }, 'iconUrl'),
    })
    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
