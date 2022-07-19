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
import { findObject, setFieldDeploymentAnnotations } from '../../utils'
import { FilterCreator } from '../../filter'
import { deployWithJspEndpoints } from '../../deployment/jsp_deployment'
import { STATUS_TYPE_NAME } from '../../constants'

const log = logger(module)
const statusCategoryNameToId = new Map([['TODO', 2], ['DONE', 3], ['IN_PROGRESS', 4]])

const filter: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === STATUS_TYPE_NAME)
      .filter(instance => instance.value.statusCategory !== undefined)
      .forEach(instance => {
        // statusCategory has a fixed number of options so we map the statusCategory name to its id
        instance.value.statusCategory = statusCategoryNameToId.get(instance.value.statusCategory)
        ?? instance.value.statusCategory
      })

    if (!config.client.usePrivateAPI) {
      log.debug('Skipping status deployment filter because private API is not enabled')
      return
    }

    const statusType = findObject(elements, STATUS_TYPE_NAME)
    if (statusType === undefined) {
      return
    }

    statusType.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    statusType.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
    statusType.annotations[CORE_ANNOTATIONS.DELETABLE] = true
    setFieldDeploymentAnnotations(statusType, 'statusCategory')
    setFieldDeploymentAnnotations(statusType, 'description')
    setFieldDeploymentAnnotations(statusType, 'name')
    setFieldDeploymentAnnotations(statusType, 'id')
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && getChangeData(change).elemID.typeName === STATUS_TYPE_NAME
    )

    if (relevantChanges.length === 0) {
      return {
        leftoverChanges,
        deployResult: {
          errors: [],
          appliedChanges: [],
        },
      }
    }

    const jspRequests = config.apiDefinitions.types[STATUS_TYPE_NAME]?.jspRequests
    if (jspRequests === undefined) {
      throw new Error(`${STATUS_TYPE_NAME} jsp urls are missing from the configuration`)
    }

    const deployResult = await deployWithJspEndpoints({
      changes: relevantChanges.filter(isInstanceChange),
      client,
      urls: jspRequests,
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
