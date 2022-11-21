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
import _ from 'lodash'
import { elements as elementUtils, config as configUtils } from '@salto-io/adapter-components'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { GROUP_TYPE_NAME, JIRA } from '../constants'
import { JiraConfig } from '../config/config'

const UUID_REGEX = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const GROUP_NAME_REGEX = new RegExp(`^(.*)-${UUID_REGEX}$`)

const isGroupElement = (element: Element): boolean =>
  element.elemID.typeName === GROUP_TYPE_NAME

const getInstanceName = (
  instance: InstanceElement,
  config: JiraConfig,
  getElemIdFunc?: ElemIdGetter
): string => {
  const match = instance.value.name.match(GROUP_NAME_REGEX)
  if (!match || !match[1]) {
    return instance.elemID.name
  }
  const baseName = match[1]
  const defaultName = naclCase(baseName)
  const { serviceIdField } = configUtils.getConfigWithDefault(
    config.apiDefinitions.types[instance.elemID.typeName].transformation,
    config.apiDefinitions.typeDefaults.transformation
  )
  if (serviceIdField === undefined || getElemIdFunc === undefined) {
    return instance.elemID.name
  }

  const serviceIds = elementUtils.createServiceIds(
    instance.value,
    serviceIdField,
    instance.refType.elemID
  )

  return getElemIdFunc(JIRA, serviceIds, defaultName).name
}

const getRenamedInstance = (
  instance: InstanceElement,
  config: JiraConfig,
  getElemIdFunc?: ElemIdGetter,
): InstanceElement => {
  const elementName = getInstanceName(instance, config, getElemIdFunc)
  const originalName = instance.value.name
  const match = instance.value.name.match(GROUP_NAME_REGEX)
  const newName = match ? match[1] : instance.value.name
  const newPath = [...(instance.path ?? []).slice(0, -1), pathNaclCase(elementName)]
  return new InstanceElement(
    elementName,
    instance.refType,
    { ...instance.value, name: newName, originalName },
    newPath,
    instance.annotations,
  )
}

/**
 * Remove uuid suffix from group names.
 */
const filter: FilterCreator = ({ config, getElemIdFunc }) => ({
  onFetch: async (elements: Element[]) => {
    const instances = _.remove(elements,
      element => isGroupElement(element) && isInstanceElement(element))
    const newInstances = instances
      .filter(isInstanceElement)
      .map(e => getRenamedInstance(e, config, getElemIdFunc))
    elements.push(...newInstances)
  },
})

export default filter
