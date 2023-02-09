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
import { CORE_ANNOTATIONS, InstanceElement, isInstanceElement, ObjectType, ReferenceExpression, Values } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { findObject, setTypeDeploymentAnnotations } from '../../utils'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME, FIELD_CONFIGURATION_TYPE_NAME } from '../../constants'

const createFieldItemInstance = (
  instance: InstanceElement,
  fieldItemValues: Values,
  fieldItemType: ObjectType,
): InstanceElement => new InstanceElement(
  naclCase(`${instance.elemID.name}_${fieldItemValues.id.elemID.name}`),
  fieldItemType,
  fieldItemValues,
  instance.path,
  {
    [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(instance.elemID, instance)],
  }
)

const filter: FilterCreator = () => ({
  name: 'fieldConfigurationSplitFilter',
  onFetch: async elements => {
    const fieldConfigurationType = findObject(elements, FIELD_CONFIGURATION_TYPE_NAME)
    const fieldConfigurationItemType = findObject(elements, FIELD_CONFIGURATION_ITEM_TYPE_NAME)

    if (fieldConfigurationType === undefined || fieldConfigurationItemType === undefined) {
      return
    }

    delete fieldConfigurationType.fields.fields
    setTypeDeploymentAnnotations(fieldConfigurationItemType)

    const fieldItems = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
      .filter(instance => instance.value.fields !== undefined)
      .flatMap(instance => instance.value.fields.map((field: Values) => {
        const item = createFieldItemInstance(
          instance,
          field,
          fieldConfigurationItemType,
        )

        delete instance.value.fields

        return item
      }))

    fieldItems.forEach(item => elements.push(item))
  },
})

export default filter
