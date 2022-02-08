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
import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { JiraConfig } from '../config'
import { FilterCreator } from '../filter'

const { generateInstanceNameFromConfig } = elementUtils


const log = logger(module)

const getInstanceName = (instance: InstanceElement, config: JiraConfig): string => {
  const originalName = generateInstanceNameFromConfig(
    instance.value,
    instance.elemID.typeName,
    config.apiDefinitions
  ) ?? instance.elemID.name
  return naclCase(`${originalName}_${instance.value.id}`)
}

/**
 * Add id to the name of instances with duplicate names to prevent conflicts in the names
 *
 * This filter assumes the adapter does not split the same element into multiple files
 */
const filter: FilterCreator = ({ config }) => ({
  onFetch: async elements => {
    const relevantInstances = elements
      .filter(isInstanceElement)
      .filter(instance => config.apiDefinitions.typesToFallbackToInternalId
        .includes(instance.elemID.typeName))

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

    const newInstances = duplicateInstances
      .filter(isInstanceElement)
      .map(instance => new InstanceElement(
        getInstanceName(instance, config),
        instance.refType,
        instance.value,
        instance.path,
        instance.annotations,
      ))

    const newNames = Array.from(newInstances.map(instance => instance.elemID.name))

    log.debug(`Replaced duplicate names with: ${newNames.join(', ')}`)
    elements.push(...newInstances)

    const isPlural = duplicateIds.size > 1

    return {
      errors: [
        {
          message: `The ${isPlural ? 'names' : 'name'} of ${Array.from(duplicateIds).join(', ')} ${isPlural ? 'are' : 'is'} not unique in the account, so the ids of the instances were added to their names, the new names are ${newNames.join(', ')}. However, that way Salto will not be able to identify that instances between environments are the same instance which will impact comparing and cloning elements between environments. It is strongly recommended to change the names of the instances to be unique in the account and then re-fetch with "Regenerate Salto IDs".`,
          severity: 'Warning',
        },
      ],
    }
  },
})

export default filter
