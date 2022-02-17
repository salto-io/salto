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
import { RESOLUTION_TYPE_NAME } from '../constants'

const log = logger(module)

const filter: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]) => {
    if (!config.client.usePrivateAPI) {
      log.debug('Skipping resolution filter because private API is not enabled')
      return
    }

    const resolutionType = findObject(elements, RESOLUTION_TYPE_NAME)
    if (resolutionType === undefined) {
      log.warn(`${RESOLUTION_TYPE_NAME} type not found, resolution filter`)
      return
    }

    resolutionType.annotations[CORE_ANNOTATIONS.CREATABLE] = true
    resolutionType.annotations[CORE_ANNOTATIONS.UPDATABLE] = true
    setDeploymentAnnotations(resolutionType, 'id')
    setDeploymentAnnotations(resolutionType, 'name')
    setDeploymentAnnotations(resolutionType, 'description')
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isAdditionOrModificationChange(change)
        && getChangeData(change).elemID.typeName === RESOLUTION_TYPE_NAME
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

    const jspRequests = config.apiDefinitions.types[RESOLUTION_TYPE_NAME]?.jspRequests
    if (jspRequests === undefined) {
      throw new Error(`${RESOLUTION_TYPE_NAME} jsp urls are missing from the configuration`)
    }

    const deployResult = await deployWithJspEndpoints({
      changes: relevantChanges.filter(isInstanceChange),
      client,
      urls: jspRequests,
    })
    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
