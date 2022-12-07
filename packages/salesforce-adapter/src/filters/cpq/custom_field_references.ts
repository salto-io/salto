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
  Element,
  Field,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
  isObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { LocalFilterCreator } from '../../filter'
import {
  CPQ_FILTER_SOURCE_FIELD,
  CPQ_FILTER_SOURCE_OBJECT,
  CPQ_HIDDEN_SOURCE_FIELD,
  CPQ_HIDDEN_SOURCE_OBJECT,
  CPQ_TARGET_FIELD,
  CPQ_TARGET_OBJECT,
  PRODUCT2_OBJECT_TYPE,
} from '../../constants'
import { apiName, isCustomObject } from '../../transformers/transformer'

const { awu, keyByAsync } = collections.asynciterable
const log = logger(module)


  type CustomFieldReferenceDef = {
  objectNameField: string
  fieldNameField: string
}


const CUSTOM_FIELD_REFERENCE_DEFS: CustomFieldReferenceDef[] = [
  { objectNameField: CPQ_FILTER_SOURCE_OBJECT, fieldNameField: CPQ_FILTER_SOURCE_FIELD },
  { objectNameField: CPQ_HIDDEN_SOURCE_OBJECT, fieldNameField: CPQ_HIDDEN_SOURCE_FIELD },
  { objectNameField: CPQ_TARGET_OBJECT, fieldNameField: CPQ_TARGET_FIELD },
]

type ReverseRecord<T extends Record<keyof T, keyof never>> = {
  [P in T[keyof T]]: {
    [K in keyof T]: T[K] extends P ? K : never
  }[keyof T]
}

type CPQObjectNameToSalesforceObjectName = {
  Product: typeof PRODUCT2_OBJECT_TYPE
}

const CPQ_OBJECT_NAME_TO_SF_OBJECT_NAME: CPQObjectNameToSalesforceObjectName = {
  Product: PRODUCT2_OBJECT_TYPE,
}

const SF_OBJECT_NAME_TO_CPQ_OBJECT_NAME: ReverseRecord<CPQObjectNameToSalesforceObjectName> = {
  [PRODUCT2_OBJECT_TYPE]: 'Product',
}

const
  getCustomObjectFieldsByApiName = async (elements: Element[]): Promise<Record<string, Field>> => {
    const customObjectFields = await awu(elements)
      .filter(isObjectType)
      .filter(isCustomObject)
      .flatMap(e => Object.values(e.fields))
      .toArray()
    return keyByAsync(customObjectFields, apiName)
  }

const getReferencedSalesforceObjectName = (cpqObjectName: string): string => {
  const correctObjectName = (CPQ_OBJECT_NAME_TO_SF_OBJECT_NAME as Record<string, string>)[cpqObjectName]
  return correctObjectName !== undefined ? correctObjectName : cpqObjectName
}

const getReferencedSalesforceFieldName = (
  { value }: InstanceElement,
  customFieldReferenceDef: CustomFieldReferenceDef
): string | undefined => {
  const objectName = getReferencedSalesforceObjectName(value[customFieldReferenceDef.objectNameField])
  const fieldName = value[customFieldReferenceDef.fieldNameField]
  return (_.isUndefined(objectName) || _.isUndefined(fieldName))
    ? undefined
    : [
      objectName,
      fieldName.replace(' ', ''),
    ].join('.')
}

const setCustomFieldReferences = (
  instance: InstanceElement,
  customObjectFieldByApiName: Record<string, Field>,
): void => {
  CUSTOM_FIELD_REFERENCE_DEFS.forEach(customFieldReferenceDef => {
    const referencedFieldName = getReferencedSalesforceFieldName(instance, customFieldReferenceDef)
    if (referencedFieldName === undefined) {
      return
    }
    const referencedField = customObjectFieldByApiName[referencedFieldName]
    if (referencedField === undefined) {
      log.warn('Could not reference unknown field %s', referencedFieldName)
      return
    }
    instance.value[customFieldReferenceDef.fieldNameField] = new ReferenceExpression(referencedField.elemID)
    delete instance.value[customFieldReferenceDef.objectNameField]
  })
}

const getCPQObjectName = (salesforceObjectName: string): string => {
  const correctObjectName = (SF_OBJECT_NAME_TO_CPQ_OBJECT_NAME as Record<string, string>)[salesforceObjectName]
  return correctObjectName !== undefined ? correctObjectName : salesforceObjectName
}

// Converts UpperCamelCase to Title Text Case
const getCPQFieldName = (salesforceFieldName: string): string => (
  // This Regex inserts a space character before every capital character.
  salesforceFieldName.replace(/([A-Z])/g, ' $1').trim()
)

const isRelatedChange = (change: Change<InstanceElement>): boolean => {
  const instance = getChangeData(change)
  const instanceFieldNames = Object.keys(instance.value)
  return CUSTOM_FIELD_REFERENCE_DEFS
    .some(def => instanceFieldNames.includes(def.fieldNameField) && !instanceFieldNames.includes(def.objectNameField))
}

const revertCustomFieldReference = async (
  instance: InstanceElement,
  def: CustomFieldReferenceDef,
): Promise<void> => {
  const { value } = instance
  const referenceFieldValue = value[def.fieldNameField]
  if (referenceFieldValue === undefined) {
    return
  }
  const [objectName, fieldName] = referenceFieldValue.split('.')
  if (objectName === undefined || fieldName === undefined) {
    return
  }
  value[def.objectNameField] = getCPQObjectName(objectName)
  value[def.fieldNameField] = getCPQFieldName(fieldName)
}

const revertCustomFieldReferences = async (instance: InstanceElement): Promise<void> => {
  await awu(CUSTOM_FIELD_REFERENCE_DEFS)
    .forEach(def => revertCustomFieldReference(instance, def))
}

const createDeployableChange = async (change: Change<InstanceElement>): Promise<Change<InstanceElement>> => {
  const deployableAfter = getChangeData(change).clone()
  await revertCustomFieldReferences(deployableAfter)
  return isModificationChange(change)
    ? toChange({ before: change.data.before, after: deployableAfter })
    : toChange({ after: deployableAfter })
}

const filter: LocalFilterCreator = () => {
  let originalChanges: Record<string, Change<InstanceElement>>
  return {
    onFetch: async (elements: Element[]) => {
      const customObjectFieldsByApiName = await getCustomObjectFieldsByApiName(elements)
      elements
        .filter(isInstanceElement)
        .forEach(instance => setCustomFieldReferences(instance, customObjectFieldsByApiName))
    },
    preDeploy: async changes => {
      const relatedChanges = changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(isRelatedChange)
      originalChanges = await keyByAsync(
        relatedChanges,
        async change => apiName(getChangeData(change))
      )
      const deployableChanges = await awu(relatedChanges)
        .map(createDeployableChange)
        .toArray()
      _.pullAll(changes, relatedChanges)
      deployableChanges.forEach(change => changes.push(change))
    },
    onDeploy: async changes => {
      const appliedChangesByApiName = await keyByAsync(
        changes,
        async change => apiName(getChangeData(change)),
      )
      const relatedAppliedChanges = _.pick(appliedChangesByApiName, Object.keys(originalChanges))
      _.pullAll(changes, Object.values(relatedAppliedChanges))
      Object.values(originalChanges).forEach(change => changes.push(change))
    },
  }
}

export default filter
