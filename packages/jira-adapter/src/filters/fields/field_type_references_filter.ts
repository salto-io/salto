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
import { Element, Field, InstanceElement, isInstanceElement, ListType, ReferenceExpression, Values } from '@salto-io/adapter-api'
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

const getDefaultOptions = (instance: InstanceElement) : {
    referencedDefaultOptions: Values[]
    referencedCascadingDefaultOption: Values | undefined } => {
  let referencedDefaultOptions: Values[]
  let referencedCascadingDefaultOption: Values | undefined

  if (instance.value.defaultValue.type.endsWith('multiple')) {
    referencedDefaultOptions = (Object.values(instance.value.options ?? {}) as Values[])
      .filter((option: Values) => (instance.value.defaultValue.optionIds ?? []).includes(option.id))
  } else {
    referencedDefaultOptions = (Object.values(instance.value.options ?? {}) as Values[])
      .filter((option: Values) => instance.value.defaultValue.optionId === option.id)
    if (referencedDefaultOptions.length > 0) {
      referencedCascadingDefaultOption = (
        _.values(referencedDefaultOptions[0].cascadingOptions ?? {})
      ).find((option: Values) => option.id === instance.value.defaultValue.cascadingOptionId)
    }
  }
  return { referencedDefaultOptions,
    referencedCascadingDefaultOption }
}

const filter: FilterCreator = () => ({
  name: 'fieldTypeReferencesFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
      .filter(instance => instance.value.defaultValue?.type !== undefined)
      .filter(instance => instance.value.defaultValue.type.startsWith('option'))
      .forEach(instance => {
        const optionsElemId = instance.elemID.createNestedID('options')
        const { referencedDefaultOptions, referencedCascadingDefaultOption } = getDefaultOptions(instance)

        if (referencedDefaultOptions.length === 0) {
          if (instance.value.defaultValue.optionIds !== undefined
              && instance.value.defaultValue.optionIds.length > 0) {
            log.warn(`Could not find reference for default options ids ${instance.value.defaultValue.optionIds} in instance ${instance.elemID.getFullName()}`)
          }
          return
        }
        const optionIdsReferences = referencedDefaultOptions
          .map(option => new ReferenceExpression(
            optionsElemId.createNestedID(naclCase(option.value)),
            option
          ))
        if (instance.value.defaultValue.type.endsWith('multiple')) {
          instance.value.defaultValue.optionIds = optionIdsReferences
        } else {
          [instance.value.defaultValue.optionId] = optionIdsReferences

          if (referencedCascadingDefaultOption === undefined) {
            if (instance.value.defaultValue.cascadingOptionId !== undefined) {
              log.warn(`Could not find reference for default cascading option id ${instance.value.defaultValue.cascadingOptionId} in instance ${instance.elemID.getFullName()}`)
            }
            return
          }
          instance.value.defaultValue.cascadingOptionId = new ReferenceExpression(
            optionsElemId.createNestedID(naclCase(referencedDefaultOptions[0].value))
              .createNestedID('cascadingOptions', naclCase(referencedCascadingDefaultOption.value)),
            referencedCascadingDefaultOption,
          )
        }
      })

    const optionType = findObject(elements, 'CustomFieldContextOption')
    const defaultValueType = findObject(elements, 'CustomFieldContextDefaultValue')

    if (optionType !== undefined && defaultValueType !== undefined) {
      defaultValueType.fields.optionId = new Field(defaultValueType, 'optionId', optionType)
      defaultValueType.fields.cascadingOptionId = new Field(defaultValueType, 'optionId', optionType)
      defaultValueType.fields.optionIds = new Field(defaultValueType, 'optionIds', new ListType(optionType))
    }
  },
})

export default filter
