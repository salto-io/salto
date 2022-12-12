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
import {
  Change,
  Element, Field, getChangeData, isAdditionOrModificationChange, isFieldChange, isModificationChange,
  isObjectType, ObjectType, ReferenceExpression, toChange,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import _ from 'lodash'
import Joi from 'joi'
import { logger } from '@salto-io/logging'
import { LocalFilterCreator } from '../../filter'
import { CPQ_NAMESPACE, CPQ_QUOTE, FIELD_ANNOTATIONS, FULL_NAME } from '../../constants'
import { getNamespace } from '../utils'
import { apiName } from '../../transformers/transformer'
import { isPicklistField } from '../value_set'

type ReverseRecord<T extends Record<keyof T, keyof never>> = {
  [P in T[keyof T]]: {
    [K in keyof T]: T[K] extends P ? K : never
  }[keyof T]
}

const log = logger(module)
const { awu, keyByAsync } = collections.asynciterable
const { makeArray } = collections.array
const { isDefined } = values

type ServiceToCPQApiName = {
  Quote: typeof CPQ_QUOTE
}

const SERVICE_TO_CPQ_API_NAME: ServiceToCPQApiName = {
  Quote: CPQ_QUOTE,
}

const CPQ_TO_SERVICE_API_NAME: ReverseRecord<ServiceToCPQApiName> = {
  [CPQ_QUOTE]: 'Quote',
}

type TransformableValueSetEntry = {
  [FULL_NAME]: keyof ServiceToCPQApiName
}

type ModifiedValueSetEntry = {
  [FULL_NAME]: keyof ReverseRecord<ServiceToCPQApiName>
}

const TRANSFORMABLE_VALUE_SET_ENTRY_SCHEMA = Joi.object({
  [FULL_NAME]: Joi.string().valid(...Object.keys(SERVICE_TO_CPQ_API_NAME)).required(),
}).unknown(true).required()

const MODIFIED_VALUE_SET_ENTRY_SCHEMA = Joi.object({
  [FULL_NAME]: Joi.string().valid(...Object.keys(CPQ_TO_SERVICE_API_NAME)).required(),
}).unknown(true).required()

const isTransformableValueSetEntry = createSchemeGuard<
  TransformableValueSetEntry>(TRANSFORMABLE_VALUE_SET_ENTRY_SCHEMA)

const isModifiedValueSetEntry = createSchemeGuard<ModifiedValueSetEntry>(MODIFIED_VALUE_SET_ENTRY_SCHEMA)

const getTransformableValueSetEntries = (field: Field): TransformableValueSetEntry[] => (
  makeArray(field.annotations[FIELD_ANNOTATIONS.VALUE_SET])
    .filter(isTransformableValueSetEntry)
)

const getObjectTransformableValueSetEntries = (objectType: ObjectType): TransformableValueSetEntry[] => (
  Object.values(objectType.fields)
    .filter(isPicklistField)
    .flatMap(getTransformableValueSetEntries)
)

const getModifiedValueSetEntries = (field: Field): ModifiedValueSetEntry[] => (
  makeArray(field.annotations[FIELD_ANNOTATIONS.VALUE_SET])
    .filter(isModifiedValueSetEntry)
)

const getDeployableChange = async (change: Change<Field>): Promise<Change<Field> | undefined> => {
  const deployableField = getChangeData(change).clone()
  const modifiedValueSetEntries = getModifiedValueSetEntries(deployableField)
  if (_.isEmpty(modifiedValueSetEntries)) {
    return undefined
  }
  modifiedValueSetEntries.forEach(valueSetEntry => {
    const serviceApiName = CPQ_TO_SERVICE_API_NAME[valueSetEntry[FULL_NAME]]
    _.set(valueSetEntry, FULL_NAME, serviceApiName)
  })
  return isModificationChange(change)
    ? toChange({ before: change.data.before, after: deployableField })
    : toChange({ after: deployableField })
}

const isCpqPicklistFieldChange = async (change: Change<Field>): Promise<boolean> => {
  const field = getChangeData(change)
  return await getNamespace(field) === CPQ_NAMESPACE && isPicklistField(field)
}

const filter: LocalFilterCreator = () => {
  let originalChangesByApiName: Record<string, Change<Field>>
  return {
    onFetch: async (elements: Element[]) => {
      const cpqObjects = await awu(elements)
        .filter(isObjectType)
        .filter(async e => await getNamespace(e) === CPQ_NAMESPACE)
        .toArray()
      const cpqObjectsByApiName = await keyByAsync(cpqObjects, apiName)
      await awu(cpqObjects)
        .flatMap(getObjectTransformableValueSetEntries)
        .forEach(valueSetEntry => {
          const cpqApiName = SERVICE_TO_CPQ_API_NAME[valueSetEntry[FULL_NAME]]
          _.set(valueSetEntry, FULL_NAME, cpqApiName)
          const matchingCpqObject = cpqObjectsByApiName[cpqApiName]
          if (_.isUndefined(matchingCpqObject)) {
            log.warn('Could not create reference to object of type %s in valueSet. Type does not exist', cpqApiName)
            return
          }
          _.set(valueSetEntry, FULL_NAME, new ReferenceExpression(matchingCpqObject.elemID))
        })
    },
    preDeploy: async changes => {
      const cpqPicklistFieldChanges = await awu(changes)
        .filter(isFieldChange)
        .filter(isAdditionOrModificationChange)
        .filter(isCpqPicklistFieldChange)
        .toArray()
      const originalChanges: Change<Field>[] = []
      const deployableChanges = await awu(cpqPicklistFieldChanges)
        .map(async change => {
          const deployableChange = await getDeployableChange(change)
          if (isDefined(deployableChange)) {
            originalChanges.push(change)
          }
          return deployableChange
        })
        .filter(isDefined)
        .toArray()
      originalChangesByApiName = await keyByAsync(originalChanges, c => apiName(getChangeData(c)))

      _.pullAll(changes, originalChanges)
      deployableChanges.forEach(change => changes.push(change))
    },
    onDeploy: async changes => {
      const appliedChangesByApiName = await keyByAsync(
        changes,
        async change => apiName(getChangeData(change)),
      )
      const relatedAppliedChanges = _.pick(appliedChangesByApiName, Object.keys(originalChangesByApiName))
      _.pullAll(changes, Object.values(relatedAppliedChanges))
      Object.values(originalChangesByApiName).forEach(change => changes.push(change))
    },
  }
}

export default filter
