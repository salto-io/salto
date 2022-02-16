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
import { CORE_ANNOTATIONS, Element, getChangeData, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { findObject, setDeploymentAnnotations } from '../../utils'
import { FilterCreator } from '../../filter'
import { deployWithJspEndpoints } from '../../deployment/jsp_deployment'
import { STATUS_TYPE_NAME } from '../../constants'
import { JspUrls } from '../../config'

const log = logger(module)

const filter: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === STATUS_TYPE_NAME)
      .filter(instance => instance.value.statusCategory !== undefined)
      .forEach(instance => {
        instance.value.statusCategory = instance.value.statusCategory.id?.toString()
      })

    if (!config.client.usePrivateAPI) {
      log.debug('Skipping status deployment filter because private API is not enabled')
      return
    }

    const statusType = findObject(elements, STATUS_TYPE_NAME)
    if (statusType === undefined) {
      log.warn(`${STATUS_TYPE_NAME} type not found, skipping status deployment filter`)
      return
    }

    statusType.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    statusType.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
    statusType.annotations[CORE_ANNOTATIONS.DELETABLE] = true
    setDeploymentAnnotations(statusType, 'statusCategory')
    setDeploymentAnnotations(statusType, 'description')
    setDeploymentAnnotations(statusType, 'iconUrl')
    setDeploymentAnnotations(statusType, 'name')
    setDeploymentAnnotations(statusType, 'id')
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === STATUS_TYPE_NAME
    )

    const deployResult = await deployWithJspEndpoints({
      changes: relevantChanges.filter(isInstanceChange),
      client,
      urls: config.apiDefinitions.types[STATUS_TYPE_NAME].jspRequests as JspUrls,
      serviceValuesTransformer: (serviceValues, currentInstance) => _.omit({
        ...currentInstance.value,
        ...serviceValues,
      }, 'iconURL'),
    })
    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
