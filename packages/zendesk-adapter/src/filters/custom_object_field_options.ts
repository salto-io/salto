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
import {
  isInstanceElement,
  Element,
  ObjectType,
  InstanceElement,
  ElemID,
  CORE_ANNOTATIONS, ReferenceExpression, BuiltinTypes,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import {
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
  ZENDESK,
} from '../constants'

const { RECORDS_PATH } = elementsUtils
const log = logger(module)

const customObjectFieldOptionType = new ObjectType({
  elemID: new ElemID(ZENDESK, CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME),
  fields: {
    id: { refType: BuiltinTypes.NUMBER, annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true } },
    name: { refType: BuiltinTypes.STRING },
    raw_name: { refType: BuiltinTypes.STRING },
    value: { refType: BuiltinTypes.STRING },
  },
})

type CustomObjectFieldOptions = {
  id: number
  name: string
  // eslint-disable-next-line camelcase
  raw_name: string
  value: string
}

const isCustomObjectFieldOptions = (options: unknown): options is CustomObjectFieldOptions[] =>
  _.isArray(options) && options.every(option =>
    _.isPlainObject(option)
    && _.isNumber(option.id)
    && _.isString(option.name)
    && _.isString(option.raw_name)
    && _.isString(option.value))

/**
 * Convert custom_field_options of custom_object_field to be instance elements
 * This is needed because 'extractStandaloneFields' doesn't support recurse into
 */
const customObjectFieldOptionsFilter: FilterCreator = () => ({
  name: 'customObjectFieldOptionsFilter',
  onFetch: async (elements: Element[]) => {
    const customObjectFields = elements
      .filter(isInstanceElement)
      .filter(obj => obj.elemID.typeName === CUSTOM_OBJECT_FIELD_TYPE_NAME)

    customObjectFields.forEach(field => {
      const options = field.value.custom_field_options
      if (options === undefined) {
        return
      }
      if (!isCustomObjectFieldOptions(options)) {
        log.error('custom_field_options is not in the expected format TODO')
        return
      }
      const instanceOptions = options.map(option => {
        const instanceName = `${field.elemID.name}__${option.value}`
        return new InstanceElement(
          instanceName,
          customObjectFieldOptionType,
          option,
          [ZENDESK, RECORDS_PATH, CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME, instanceName],
          { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(field.elemID, field)] }
        )
      })

      field.value.custom_field_options = instanceOptions.map(option => new ReferenceExpression(option.elemID, option))
      elements.push(...instanceOptions)
    })
  },
})

export default customObjectFieldOptionsFilter
