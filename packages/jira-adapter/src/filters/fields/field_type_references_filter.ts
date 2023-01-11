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
import { Element, Field, isInstanceElement, ReferenceExpression, Values } from '@salto-io/adapter-api'
import { GetLookupNameFunc, naclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { findObject } from '../../utils'
import { FIELD_CONTEXT_TYPE_NAME } from './constants'

const log = logger(module)

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
      .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
      .forEach(instance => {
        const optionsElemId = instance.elemID.createNestedID('options')

        const referencedDefaultOption = (Object.values(instance.value.options ?? {}) as Values[])
          .find((option: Values) => option.id === instance.value.defaultValue?.optionId)

        if (referencedDefaultOption === undefined) {
          if (instance.value.defaultValue?.optionId !== undefined) {
            log.warn(`Could not find reference for default option id ${instance.value.defaultValue.optionId} in instance ${instance.elemID.getFullName()}`)
          }
          return
        }
        const defaultOptionElemId = optionsElemId
          .createNestedID(naclCase(referencedDefaultOption.value))
        instance.value.defaultValue.optionId = new ReferenceExpression(
          defaultOptionElemId,
          referencedDefaultOption,
        )

        const referencedCascadingDefaultOption = (
          _.values(referencedDefaultOption.cascadingOptions ?? {})
        ).find((option: Values) => option.id === instance.value.defaultValue?.cascadingOptionId)

        if (referencedCascadingDefaultOption === undefined) {
          if (instance.value.defaultValue?.cascadingOptionId !== undefined) {
            log.warn(`Could not find reference for default cascading option id ${instance.value.defaultValue.cascadingOptionId} in instance ${instance.elemID.getFullName()}`)
          }
          return
        }
        instance.value.defaultValue.cascadingOptionId = new ReferenceExpression(
          defaultOptionElemId.createNestedID('cascadingOptions', naclCase(referencedCascadingDefaultOption.value)),
          referencedCascadingDefaultOption,
        )
      })

    const optionType = findObject(elements, 'CustomFieldContextOption')
    const defaultValueType = findObject(elements, 'CustomFieldContextDefaultValue')

    if (optionType !== undefined && defaultValueType !== undefined) {
      defaultValueType.fields.optionId = new Field(defaultValueType, 'optionId', optionType)
      defaultValueType.fields.cascadingOptionId = new Field(defaultValueType, 'optionId', optionType)
    }
  },
})

export default filter
