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
import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { naclCase, elementExpressionStringifyReplacer, safeJsonStringify } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'

const log = logger(module)

const getInstanceName = (instance: InstanceElement): string =>
  naclCase(`${instance.elemID.name}_${instance.value.id}`)

/**
 * Add id to the name of instances with duplicate names to prevent conflicts in the names
 *
 * This filter assumes the adapter does not split the same element into multiple files
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'duplicateIdsFilter',
  onFetch: async elements => {
    const relevantInstances = elements
      .filter(isInstanceElement)

    const duplicateIds = new Set(_(relevantInstances)
      .countBy(instance => instance.elemID.getFullName())
      .pickBy(count => count > 1)
      .keys()
      .value())

    if (duplicateIds.size === 0) {
      return {}
    }


    log.warn(`Found ${duplicateIds.size} duplicate instance names: ${Array.from(duplicateIds).join(', ')}`)

    const duplicateInstances = _.remove(
      elements,
      element => duplicateIds.has(element.elemID.getFullName())
        && isInstanceElement(element)
        && element.value.id !== undefined
    )

    duplicateInstances
      .filter(isInstanceElement)
      .forEach(instance => {
        log.debug(`Found a duplicate instance ${instance.elemID.getFullName()} with values: ${safeJsonStringify(instance.value, elementExpressionStringifyReplacer, 2)}`)
      })

    if (!config.fetch.fallbackToInternalId) {
      return {
        errors: [
          {
            message: `The following elements had duplicate names in Jira: ${Array.from(duplicateIds).join(', ')}. It is strongly recommended to rename these instances so they are unique in Jira, then re-fetch.
If changing the names is not possible, you can add the fetch.fallbackToInternalId option to the configuration file; that will add their internal ID to their names and fetch them. Read more here: https://help.salto.io/en/articles/6927157-salto-id-collisions`,
            severity: 'Warning',
          },
        ],
      }
    }

    const newInstances = duplicateInstances
      .filter(isInstanceElement)
      .filter(instance => config.apiDefinitions.typesToFallbackToInternalId
        .includes(instance.elemID.typeName))
      .map(instance => new InstanceElement(
        getInstanceName(instance),
        instance.refType,
        instance.value,
        instance.path,
        instance.annotations,
      ))

    const newNames = Array.from(newInstances.map(instance => instance.elemID.name))

    log.debug(`Replaced duplicate names with: ${newNames.join(', ')}`)
    elements.push(...newInstances)

    return {
      errors: [
        {
          message: `The following elements had duplicate names in Jira and therefore their internal id was added to their names: ${newNames.join(', ')}. It is strongly recommended to rename these instances so they are unique in Jira, then re-fetch with the "Regenerate Salto IDs" fetch option. Read more here: https://help.salto.io/en/articles/6927157-salto-id-collisions.`,
          severity: 'Warning',
        },
      ],
    }
  },
})

export default filter
