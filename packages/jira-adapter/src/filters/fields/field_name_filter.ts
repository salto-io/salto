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
import { Element, ElemIdGetter, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { elements as elementUtils, config as configUtils } from '@salto-io/adapter-components'
import { naclCase } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { JiraConfig } from '../../config'
import { JIRA } from '../../constants'
import { FilterCreator } from '../../filter'
import { FIELD_TYPE_NAME } from './constants'

const { generateInstanceNameFromConfig } = elementUtils

// Added to avoid conflicts with names
// of custom fields and system fields
export const CUSTOM_FIELDS_SUFFIX = '__c'

const getInstanceName = (
  instance: InstanceElement,
  config: JiraConfig,
  getElemIdFunc?: ElemIdGetter
): string => {
  const baseName = generateInstanceNameFromConfig(
    instance.value,
    instance.elemID.typeName,
    config.apiDefinitions
  )

  if (baseName === undefined) {
    return instance.elemID.name
  }

  const defaultName = naclCase(`${baseName}${CUSTOM_FIELDS_SUFFIX}`)

  const { serviceIdField } = configUtils.getConfigWithDefault(
    config.apiDefinitions.types[instance.elemID.typeName].transformation,
    config.apiDefinitions.typeDefaults.transformation
  )

  if (serviceIdField === undefined || getElemIdFunc === undefined) {
    return defaultName
  }

  const serviceIds = elementUtils.createServiceIds(
    instance.value,
    serviceIdField,
    instance.refType.elemID
  )

  return getElemIdFunc(JIRA, serviceIds, defaultName).name
}

// Add __c suffix to custom fields to avoid conflicts between custom fields to system fields
const filter: FilterCreator = ({ config, getElemIdFunc }) => ({
  onFetch: async (elements: Element[]) => {
    const customFields = _.remove(
      elements,
      element => isInstanceElement(element)
        && element.elemID.typeName === FIELD_TYPE_NAME
        && element.value.schema?.custom !== undefined
    )

    const newCustomFields = customFields
      .filter(isInstanceElement)
      .map(instance => {
        const name = getInstanceName(instance, config, getElemIdFunc)
        return new InstanceElement(
          name,
          instance.refType,
          instance.value,
          instance.path,
          instance.annotations,
        )
      })

    elements.push(...newCustomFields)
  },
})

export default filter
