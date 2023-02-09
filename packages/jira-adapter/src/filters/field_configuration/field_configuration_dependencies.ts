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
import { InstanceElement, isInstanceElement, isReferenceExpression, ReferenceExpression, Values } from '@salto-io/adapter-api'
import _ from 'lodash'
import { extendGeneratedDependencies, getParents } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME, PROJECT_TYPE } from '../../constants'

const log = logger(module)

const getProjectUsedFields = (instance: InstanceElement): InstanceElement[] => {
  if (!isReferenceExpression(instance.value.issueTypeScreenScheme)) {
    return []
  }
  return instance.value.issueTypeScreenScheme.value.value.issueTypeMappings
    ?.map((item: Values) => item.screenSchemeId)
    .filter(isReferenceExpression)
    .flatMap((screenSchemeRef: ReferenceExpression) => Object.values(
      screenSchemeRef.value.value.screens
    ))
    .filter(isReferenceExpression)
    .flatMap((screenRef: ReferenceExpression) => Object.values(screenRef.value.value.tabs))
    .flatMap((tab: Values) => tab.fields)
    .filter(isReferenceExpression)
    .map((fieldRef: ReferenceExpression) => fieldRef.value) ?? []
}

const getProjectFieldConfigurations = (instance: InstanceElement): InstanceElement[] => {
  const fieldConfigurationRef = instance.value.fieldConfigurationScheme
  if (!isReferenceExpression(fieldConfigurationRef)) {
    if (fieldConfigurationRef !== undefined) {
      log.warn(`${instance.elemID.getFullName()} has a field configuration scheme value that is not a reference so we can't calculate the _generated_dependencies`)
    }
    return []
  }
  return fieldConfigurationRef.value.value.items
    ?.map((item: Values) => item.fieldConfigurationId)
    .filter(isReferenceExpression)
    .map((fieldConfigRef: ReferenceExpression) => fieldConfigRef.value) ?? []
}


const getProjectUsedFieldConfigItems = (
  instance: InstanceElement,
  fieldConfigurationItems: Record<string, InstanceElement[]>
): InstanceElement[] => {
  const usedFieldNames = new Set(
    getProjectUsedFields(instance).map(field => field.elemID.getFullName())
  )

  return getProjectFieldConfigurations(instance)
    .flatMap(fieldConfig => fieldConfigurationItems[fieldConfig.elemID.getFullName()] ?? [])
    .filter(item => usedFieldNames.has(item.value.id.elemID.getFullName()))
}

const filter: FilterCreator = () => ({
  name: 'fieldConfigurationDependenciesFilter',
  onFetch: async elements => {
    const instances = elements.filter(isInstanceElement)
    const fieldConfigurationItems = _(instances)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_ITEM_TYPE_NAME)
      .groupBy(instance => getParents(instance)[0].elemID.getFullName())
      .value()

    instances
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
      .forEach(instance => {
        const fieldConfigItems = getProjectUsedFieldConfigItems(instance, fieldConfigurationItems)
        extendGeneratedDependencies(
          instance,
          fieldConfigItems.map(item => ({
            reference: new ReferenceExpression(item.elemID, item),
          }))
        )
      })
  },
})

export default filter
