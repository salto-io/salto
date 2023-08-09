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
import {
  ChangeError,
  ChangeValidator,
  getChangeData, InstanceElement,
  isAdditionChange, isInstanceChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { ZendeskApiConfig } from '../config'

const { generateInstanceNameFromConfig } = elementUtils
const { isDefined } = lowerDashValues

const log = logger(module)

const TYPES_TO_CHECK = ['group']

/**
  * Prevent deployment of two instances with the same values of their id fields
 */
export const duplicateIdFieldValuesValidator = (
  apiConfig: ZendeskApiConfig,
): ChangeValidator => async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run duplicateIdFieldValuesValidator because element source is undefined')
    return []
  }

  const changedInstancesByType = _.groupBy(
    changes
      .filter(isAdditionChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => TYPES_TO_CHECK.includes(instance.elemID.typeName)),
    change => change.elemID.typeName
  )

  const errors = await Promise.all(Object.entries(changedInstancesByType).map(async ([typeName, instances]) => {
    const typeInstances = await getInstancesFromElementSource(elementSource, [typeName])
    const instancesByIdFields: Record<string, InstanceElement[]> = {}
    // generated name can be undefined, so we can't use _.groupBy
    typeInstances.forEach(instance => {
      const instanceName = generateInstanceNameFromConfig(instance.value, typeName, apiConfig)
      if (instanceName) {
        instancesByIdFields[instanceName] = (instancesByIdFields[instanceName] ?? []).concat(instance)
      }
    })

    return instances.map((instance): ChangeError | undefined => {
      const instanceName = generateInstanceNameFromConfig(instance.value, typeName, apiConfig)
      if (!instanceName) {
        return undefined
      }
      const instancesWithSameIdFields = instancesByIdFields[instanceName]
        .filter(i => i.elemID.getFullName() !== instance.elemID.getFullName())
      return instancesWithSameIdFields.length > 0
        ? {
          elemID: instance.elemID,
          severity: 'Error',
          message: `${typeName} duplication detected`,
          detailedMessage: `This ${typeName} cannot be deployed as it is a duplicate of '${instancesWithSameIdFields.map(i => i.elemID.name).join(', ')}'. This likely indicates a misalignment of Salto IDs. To address this, please execute a fetch on both the source and target environments. Ensure you select the 'Regenerate Salto IDs' option in the advanced settings.`,
        }
        : undefined
    }).filter(isDefined)
  }))
  return errors.flat()
}
