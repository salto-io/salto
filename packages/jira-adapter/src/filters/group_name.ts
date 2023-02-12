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
import { Element, ElemIdGetter, getChangeData, InstanceElement, isAdditionChange, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { elements as elementUtils, config as configUtils } from '@salto-io/adapter-components'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { GROUP_TYPE_NAME, JIRA } from '../constants'
import { JiraConfig } from '../config/config'

const UUID_REGEX = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const GROUP_NAME = 'trusted-users'
const TRUSTED_GROUP_NAME_REGEX = new RegExp(`^${GROUP_NAME}-${UUID_REGEX}$`)

const isGroupElement = (element: Element): boolean =>
  element.elemID.typeName === GROUP_TYPE_NAME

const isTrustedGroupInstance = (instance: InstanceElement): boolean =>
  TRUSTED_GROUP_NAME_REGEX.exec(instance.value.name) !== null

const getInstanceName = (
  instance: InstanceElement,
  config: JiraConfig,
  getElemIdFunc?: ElemIdGetter
): string => {
  if (!isTrustedGroupInstance(instance)) {
    return instance.elemID.name
  }
  const defaultName = naclCase(GROUP_NAME)
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

const getGroupName = (instance: InstanceElement): string => (
  isTrustedGroupInstance(instance)
    ? GROUP_NAME
    : instance.value.name
)

const getRenamedInstance = (
  instance: InstanceElement,
  config: JiraConfig,
  getElemIdFunc?: ElemIdGetter,
): InstanceElement => {
  const elementName = getInstanceName(instance, config, getElemIdFunc)
  const originalName = instance.value.name
  const newName = getGroupName(instance)
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
  name: 'groupNameFilter',
  onFetch: async (elements: Element[]) => {
    const instances = _.remove(elements,
      element => isGroupElement(element) && isInstanceElement(element))
    const newInstances = instances
      .filter(isInstanceElement)
      .map(e => getRenamedInstance(e, config, getElemIdFunc))
    newInstances.forEach(instance => elements.push(instance))
  },
  onDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(instance => isGroupElement(instance))
      .forEach(instance => {
        instance.value.originalName = instance.value.name
        instance.value.name = getGroupName(instance)
      })
  },
})

export default filter
