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
import { Element, Field, isInstanceElement, isObjectType, ObjectType, ReferenceExpression, Value } from '@salto-io/adapter-api'
import { GetLookupNameFunc, naclCase } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../../filter'

export const getFieldsLookUpName: GetLookupNameFunc = ({
  ref, path,
}) => {
  if (path !== undefined && ['optionId', 'cascadingOptionId'].includes(path.name)) {
    return ref.value.id
  }
  return ref
}

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === 'Field')
      .forEach(instance => {
        Object.values(instance.value.contexts ?? {}).forEach((context: Value) => {
          const optionsElemId = instance.elemID.createNestedID('contexts', naclCase(context.name), 'options')
          const optionsById = _(context.options ?? {})
            .values()
            .keyBy(option => option.id)
            .value()

          _.mapValues(context.options ?? {}, option => {
            const referencedOption = optionsById[option.optionId]
            if (referencedOption !== undefined) {
              option.optionId = new ReferenceExpression(
                optionsElemId.createNestedID(naclCase(referencedOption.value)),
                referencedOption
              )
            }
          })

          const referencedDefaultOption = optionsById[context.defaultValue?.optionId]
          if (referencedDefaultOption !== undefined) {
            context.defaultValue.optionId = new ReferenceExpression(
              optionsElemId.createNestedID(naclCase(referencedDefaultOption.value)),
              referencedDefaultOption,
            )
          }

          const referencedCascadingDefaultOption = optionsById[
            context.defaultValue?.cascadingOptionId
          ]
          if (referencedCascadingDefaultOption !== undefined) {
            context.defaultValue.cascadingOptionId = new ReferenceExpression(
              optionsElemId.createNestedID(naclCase(referencedCascadingDefaultOption.value)),
              referencedCascadingDefaultOption,
            )
          }
        })
      })

    const optionType = elements.find(
      element => isObjectType(element)
        && element.elemID.typeName === 'CustomFieldContextOption'
    ) as ObjectType | undefined

    const defaultValueType = elements.find(
      element => isObjectType(element)
        && element.elemID.typeName === 'CustomFieldContextDefaultValue'
    ) as ObjectType | undefined

    if (optionType !== undefined && defaultValueType !== undefined) {
      optionType.fields.optionId = new Field(optionType, 'optionId', optionType)
      defaultValueType.fields.optionId = new Field(defaultValueType, 'optionId', optionType)
      defaultValueType.fields.cascadingOptionId = new Field(defaultValueType, 'optionId', optionType)
    }
  },
})

export default filter
