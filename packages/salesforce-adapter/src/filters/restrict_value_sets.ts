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
  Element,
  Field,
  isObjectType,
  InstanceElement, isInstanceElement, ReferenceExpression, CORE_ANNOTATIONS, createRestriction,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { FilterWith, LocalFilterCreator } from '../filter'
import {
  FIELD_ANNOTATIONS,
  GLOBAL_VALUE_SET_METADATA_TYPE,
  INSTANCE_FULL_NAME_FIELD,
  VALUE_SET_FIELDS,
} from '../constants'
import { isCustomObject, apiName } from '../transformers/transformer'
import { isInstanceOfType, buildElementsSourceForFetch } from './utils'

const { awu, keyByAsync } = collections.asynciterable
const log = logger(module)

type EntryWithFullName = {
  [INSTANCE_FULL_NAME_FIELD]: string
}

type GlobalValueSetField = Field & {
  annotations: Field['annotations'] & {
    valueSetName: string
  }
}

type ValueSetFieldAnnotations = Field['annotations'] & {
  [FIELD_ANNOTATIONS.VALUE_SET]: EntryWithFullName[]
}

type ValueSetField = Field & {
  annotations: ValueSetFieldAnnotations
}

type GlobalValueSetValue = InstanceElement['value'] & {
  [FIELD_ANNOTATIONS.CUSTOM_VALUE]: EntryWithFullName[]
}
const ENTRY_WITH_FULL_NAME_SCHEMA = Joi.object({
  [INSTANCE_FULL_NAME_FIELD]: Joi.string().required(),
}).unknown(true).required()

const GLOBAL_VALUE_SET_VALUE_SCHEMA = Joi.object({
  [FIELD_ANNOTATIONS.CUSTOM_VALUE]: Joi.array().items(ENTRY_WITH_FULL_NAME_SCHEMA).required(),
}).unknown(true).required()

const VALUE_SET_FIELD_ANNOTATIONS_SCHEMA = Joi.object({
  [FIELD_ANNOTATIONS.VALUE_SET]: Joi.array().items(ENTRY_WITH_FULL_NAME_SCHEMA).required(),
}).unknown(true).required()

const isGlobalValueSetValue = createSchemeGuard<GlobalValueSetValue, InstanceElement['value']>(GLOBAL_VALUE_SET_VALUE_SCHEMA, 'invalid GlobalValueSet value')

const isGlobalValueSetField = (field: Field): field is GlobalValueSetField => (
  _.isString(field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME])
)
const isValueSetFieldAnnotations = createSchemeGuard<ValueSetFieldAnnotations, Field['annotations']>(VALUE_SET_FIELD_ANNOTATIONS_SCHEMA)

const isValueSetField = (field: Field): field is ValueSetField => (
  isValueSetFieldAnnotations(field.annotations)
)

const setRefAndRestrict = (
  field: GlobalValueSetField,
  globalValueSetByName: Record<string, InstanceElement>
): void => {
  const globalValueSetName = field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]
  const globalValueSetInstance = globalValueSetByName[globalValueSetName]
  if (globalValueSetInstance === undefined) {
    log.warn('Could not find GlobalValueSet instance with name %s', globalValueSetName)
    return
  }
  const globalValueSetValue = globalValueSetInstance.value
  if (!isGlobalValueSetValue(globalValueSetValue)) {
    return
  }
  field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME] = new ReferenceExpression(globalValueSetInstance.elemID)
  field.annotations[CORE_ANNOTATIONS.RESTRICTION] = createRestriction({
    enforce_value: false,
    values: globalValueSetValue.customValue.map(entry => entry[INSTANCE_FULL_NAME_FIELD]),
  })
}

const restrictValueSet = (field: ValueSetField): void => {
  field.annotations[CORE_ANNOTATIONS.RESTRICTION] = createRestriction({
    enforce_value: false,
    values: field.annotations[FIELD_ANNOTATIONS.VALUE_SET].map(entry => entry[INSTANCE_FULL_NAME_FIELD]),
  })
}

const filterCreator: LocalFilterCreator = ({ config }): FilterWith<'onFetch'> => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const referenceElements = buildElementsSourceForFetch(elements, config)
    const globalValueSetInstances = await awu((await referenceElements.getAll()))
      .filter(isInstanceElement)
      .filter(isInstanceOfType(GLOBAL_VALUE_SET_METADATA_TYPE))
      .toArray()
    const globalValueSetByName = await keyByAsync(globalValueSetInstances, apiName)
    const customObjectFields = elements
      .filter(isObjectType)
      .filter(isCustomObject)
      .flatMap(customObject => Object.values(customObject.fields))

    customObjectFields
      .filter(isGlobalValueSetField)
      .forEach(field => setRefAndRestrict(field, globalValueSetByName))

    customObjectFields
      .filter(isValueSetField)
      .forEach(restrictValueSet)
  },
})

export default filterCreator
