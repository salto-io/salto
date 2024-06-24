/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  InstanceElement,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  isObjectType,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { inspectValue, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import {
  CUSTOM_FIELD_OPTIONS_FIELD_NAME,
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
  ZENDESK,
} from '../../constants'
import { createDeployOptionsWithParentCreator } from './deploy_with_parent_creator'

const { RECORDS_PATH } = elementsUtils
const log = logger(module)

const FILTER_NAME = 'customObjectFieldOptionsFilter'

type CustomObjectFieldOption = {
  id: number
  name: string
  // eslint-disable-next-line camelcase
  raw_name: string
  value: string
}

const isCustomObjectFieldOptions = (options: unknown): options is CustomObjectFieldOption[] =>
  _.isArray(options) &&
  options.every(
    option =>
      _.isPlainObject(option) &&
      _.isNumber(option.id) &&
      _.isString(option.name) &&
      _.isString(option.raw_name) &&
      _.isString(option.value),
  )

const onFetch = async (elements: Element[]): Promise<void> => {
  const customObjectFields = elements
    .filter(isInstanceElement)
    .filter(obj => obj.elemID.typeName === CUSTOM_OBJECT_FIELD_TYPE_NAME)

  customObjectFields.forEach(customObjectField => {
    const options = customObjectField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME]
    if (options === undefined) {
      return
    }
    if (!isCustomObjectFieldOptions(options)) {
      log.error(
        `custom_field_options of ${customObjectField.elemID.getFullName()} is not in the expected format - ${inspectValue(options)}`,
      )
      return
    }
    const customObjectFieldOptionType = elements
      .filter(isObjectType)
      .find(e => e.elemID.typeName === CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME)
    if (customObjectFieldOptionType === undefined) {
      log.error(`${CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME} object type not found`)
      return
    }
    const optionInstances = options.map(option => {
      const instanceName = naclCase(`${customObjectField.elemID.name}__${option.value}`)
      return new InstanceElement(
        instanceName,
        customObjectFieldOptionType,
        option,
        [ZENDESK, RECORDS_PATH, CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME, pathNaclCase(instanceName)],
        { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(customObjectField.elemID, customObjectField)] },
      )
    })

    customObjectField.value.custom_field_options = optionInstances.map(
      option => new ReferenceExpression(option.elemID, option),
    )
    elements.push(...optionInstances)
  })
}

/**
 * Convert custom_field_options of custom_object_field to be instance elements
 * This is needed because 'extractStandaloneFields' doesn't support types from 'recurse into'
 * On deploy, parse 'custom_field_options' to values before deploy
 */
const customObjectFieldOptionsFilter = createDeployOptionsWithParentCreator({
  filterName: FILTER_NAME,
  parentTypeName: CUSTOM_OBJECT_FIELD_TYPE_NAME,
  childTypeName: CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  onFetch,
})

export default customObjectFieldOptionsFilter
