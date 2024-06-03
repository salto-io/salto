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
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrRemovalChange,
  isInstanceChange,
  isRemovalChange,
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

// Type to field names that together create a unique id in zendesk
const ZENDESK_ID_FIELDS: Record<string, string[]> = {
  group: ['name'],
}

export const toZendeskId = (typeName: string, instance: InstanceElement): string =>
  ZENDESK_ID_FIELDS[typeName]
    .map(fieldName => instance.value[fieldName])
    .filter(isDefined)
    .join()

/**
 * Prevent deployment of two instances that would error on Zendesk because of duplication
 * If the instances has a different element name, we assume it's the same instance and suggest to regenerate salto ids
 */
export const duplicateIdFieldValuesValidator =
  (apiConfig: ZendeskApiConfig): ChangeValidator =>
  async (changes, elementSource) => {
    if (elementSource === undefined) {
      log.error('Failed to run duplicateIdFieldValuesValidator because element source is undefined')
      return []
    }

    const changedInstancesByType = _.groupBy(
      changes
        .filter(isAdditionOrRemovalChange)
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => Object.keys(ZENDESK_ID_FIELDS).includes(instance.elemID.typeName)),
      change => change.elemID.typeName,
    )

    const errors = await Promise.all(
      Object.entries(changedInstancesByType).map(async ([typeName, instances]) => {
        // Removals are not in the elementSource
        const typeRemovals = changes
          .filter(isRemovalChange)
          .filter(isInstanceChange)
          .map(getChangeData)
          .filter(instance => instance.elemID.typeName === typeName)
        const typeInstances = typeRemovals.concat(await getInstancesFromElementSource(elementSource, [typeName]))
        const instancesByZendeskId = _.groupBy(typeInstances, instance => toZendeskId(typeName, instance))
        const instancesByIdFields = _.groupBy(typeInstances, instance =>
          generateInstanceNameFromConfig(instance.value, typeName, apiConfig),
        )

        return instances
          .map((instance): ChangeError | undefined => {
            const instanceZendeskId = toZendeskId(typeName, instance)
            const instanceElemName = generateInstanceNameFromConfig(instance.value, typeName, apiConfig)

            const instancesWithSameZendeskId = instancesByZendeskId[instanceZendeskId].filter(
              i => i.elemID.getFullName() !== instance.elemID.getFullName(),
            )
            const instancesWithSameName =
              instanceElemName === undefined
                ? []
                : instancesByIdFields[instanceElemName].filter(
                    i => i.elemID.getFullName() !== instance.elemID.getFullName(),
                  )

            if (instancesWithSameZendeskId.length === 0) {
              return undefined
            }

            return instancesWithSameName.length > 0
              ? // This is probably a misalignment of Salto IDs, we prevent deployment and suggest to regenerate them
                {
                  elemID: instance.elemID,
                  severity: 'Error',
                  message: `${typeName} duplication detected`,
                  detailedMessage: `This ${typeName} cannot be deployed as it is a duplicate of '${instancesWithSameName.map(i => i.elemID.name).join(', ')}'. This likely indicates a misalignment of Salto IDs. To address this, please execute a fetch on both the source and target environments. Ensure you select the 'Regenerate Salto IDs' option in the advanced settings. More details can be found here: https://help.salto.io/en/articles/8290892-misalignment-of-salto-element-ids`,
                }
              : // This is probably a duplication created by the user, we prevent it from being deployed
                {
                  elemID: instance.elemID,
                  severity: 'Error',
                  message: `${typeName} duplication detected`,
                  detailedMessage: `This ${typeName} cannot be deployed due to duplication of fields '${ZENDESK_ID_FIELDS[typeName].join(', ')}' with existing instances '${instancesWithSameZendeskId.map(i => i.elemID.name).join(', ')}'. Please ensure that these field values are unique before deploying.`,
                }
          })
          .filter(isDefined)
      }),
    )
    return errors.flat()
  }
