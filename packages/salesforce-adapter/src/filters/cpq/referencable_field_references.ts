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
  Change,
  Element,
  getChangeData,
  InstanceElement, isAdditionOrModificationChange, isInstanceChange,
  isInstanceElement,
  isObjectType,
  ObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { collections, types } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../../filter'
import {
  CPQ_FILTER_SOURCE_FIELD,
  CPQ_FILTER_SOURCE_OBJECT,
  CPQ_HIDDEN_SOURCE_FIELD,
  CPQ_HIDDEN_SOURCE_OBJECT, CPQ_NAMESPACE,
  CPQ_QUOTE,
  CPQ_SUBSCRIPTION,
  CPQ_TARGET_FIELD,
  CPQ_TARGET_OBJECT,
} from '../../constants'
import { apiName, isCustomObject, relativeApiName } from '../../transformers/transformer'
import { getNamespace } from '../utils'


const log = logger(module)
const { awu, keyByAsync } = collections.asynciterable

const REFERENCABLE_FIELD_NAMES = [
  CPQ_FILTER_SOURCE_FIELD,
  CPQ_HIDDEN_SOURCE_FIELD,
  CPQ_TARGET_FIELD,
] as const

type ReferencableFieldName = typeof REFERENCABLE_FIELD_NAMES[number]


type ServiceToCPQApiName = {
  Product: 'Product2'
  Quote: typeof CPQ_QUOTE
  Subscription: typeof CPQ_SUBSCRIPTION
}
const SERVICE_TO_CPQ_API_NAME: ServiceToCPQApiName = {
  Product: 'Product2',
  Quote: CPQ_QUOTE,
  Subscription: CPQ_SUBSCRIPTION,
}

const CPQ_TO_SERVICE_API_NAME: types.ReverseRecord<ServiceToCPQApiName> = {
  Product2: 'Product',
  [CPQ_QUOTE]: 'Quote',
  [CPQ_SUBSCRIPTION]: 'Subscription',
}

const REFERENCABLE_FIELD_NAME_TO_CONTROLLING_FIELD: Record<ReferencableFieldName, string> = {
  [CPQ_FILTER_SOURCE_FIELD]: CPQ_FILTER_SOURCE_OBJECT,
  [CPQ_HIDDEN_SOURCE_FIELD]: CPQ_HIDDEN_SOURCE_OBJECT,
  [CPQ_TARGET_FIELD]: CPQ_TARGET_OBJECT,
}

const isCPQInstance = async (instance: InstanceElement): Promise<boolean> => (
  await getNamespace(await instance.getType()) === CPQ_NAMESPACE
)


const getCPQObjectApiName = (serviceApiName: string): string => (
  (SERVICE_TO_CPQ_API_NAME as Record<string, string>)[serviceApiName] ?? serviceApiName
)

const setReferences = async (
  { value }: InstanceElement,
  referencableFieldName: ReferencableFieldName,
  customObjectsByApiName: Record<string, ObjectType>
): Promise<void> => {
  const controllingFieldName = REFERENCABLE_FIELD_NAME_TO_CONTROLLING_FIELD[referencableFieldName]
  if (value[referencableFieldName] === undefined || value[controllingFieldName] === undefined) {
    return
  }
  const objectApiName = getCPQObjectApiName(value[controllingFieldName])
  const fieldApiName = value[referencableFieldName]
  const referencedObject = customObjectsByApiName[objectApiName]
  if (referencedObject === undefined) {
    log.warn('Could not find CustomObject with apiName: %s.', objectApiName)
    return
  }
  value[controllingFieldName] = new ReferenceExpression(referencedObject.elemID)
  const referencedField = referencedObject.fields[fieldApiName]
  if (referencedField === undefined) {
    log.warn('Could not find field %s on type %s.', fieldApiName, objectApiName)
    return
  }
  value[referencableFieldName] = new ReferenceExpression(referencedField.elemID)
}

const setCustomFieldReferences = async (
  instance: InstanceElement,
  customObjectByApiName: Record<string, ObjectType>,
): Promise<void> => {
  await awu(REFERENCABLE_FIELD_NAMES).forEach(referencableFieldName =>
    setReferences(instance, referencableFieldName, customObjectByApiName))
}

const isRelatedChange = (change: Change<InstanceElement>): boolean => {
  const instance = getChangeData(change)
  const instanceFieldNames = Object.keys(instance.value)
  return instanceFieldNames
    .some(fieldName => (REFERENCABLE_FIELD_NAMES as ReadonlyArray<string>).includes(fieldName))
}

const getServiceObjectApiName = (cpqApiName: string): string => {
  const actualCPQApiName = relativeApiName(cpqApiName)
  return (CPQ_TO_SERVICE_API_NAME as Record<string, string>)[actualCPQApiName] ?? actualCPQApiName
}

const createDeployableInstance = (instance: InstanceElement): InstanceElement => {
  const deployableInstance = instance.clone()
  const { value } = deployableInstance
  REFERENCABLE_FIELD_NAMES.forEach(referencableFieldName => {
    const controllingFieldName = REFERENCABLE_FIELD_NAME_TO_CONTROLLING_FIELD[referencableFieldName]
    if (value[referencableFieldName] === undefined || value[controllingFieldName] === undefined) {
      return
    }
    value[controllingFieldName] = getServiceObjectApiName(value[controllingFieldName])
    value[referencableFieldName] = getServiceObjectApiName(value[referencableFieldName])
  })
  return deployableInstance
}

const filter: LocalFilterCreator = () => {
  let originalChangesByFullName: Record<string, Change<InstanceElement>>
  return {
    name: 'cpqReferencableFieldReferencesFilter',
    onFetch: async (elements: Element[]) => {
      const customObjects = await awu(elements)
        .filter(isObjectType)
        .filter(isCustomObject)
        .toArray()
      const customObjectsByApiName = await keyByAsync(customObjects, apiName)
      await awu(elements)
        .filter(isInstanceElement)
        .filter(isCPQInstance)
        .forEach(instance => setCustomFieldReferences(instance, customObjectsByApiName))
    },
    preDeploy: async changes => {
      const relatedChanges = changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(isRelatedChange) as Change<InstanceElement>[]
      originalChangesByFullName = _.keyBy(relatedChanges, c => getChangeData(c).elemID.getFullName())
      const deployableChanges = await awu(relatedChanges)
        .map(change => applyFunctionToChangeData(change, createDeployableInstance))
        .toArray()
      _.pullAll(changes, relatedChanges)
      deployableChanges.forEach(deployableChange => changes.push(deployableChange))
    },
    onDeploy: async changes => {
      const appliedChangesByFullName = _.keyBy(
        changes.filter(isInstanceChange),
        change => getChangeData(change).elemID.getFullName(),
      )
      const relatedAppliedChanges = _.pick(appliedChangesByFullName, Object.keys(originalChangesByFullName))
      // Enrich the original changes with any extra data from the applied changes (e.g. Id, OwnerId etc...)
      Object.entries(originalChangesByFullName)
        .forEach(([changeApiName, originalChange]) => {
          const appliedChange = appliedChangesByFullName[changeApiName]
          if (appliedChange === undefined) {
            return
          }
          const appliedInstanceValue = getChangeData(appliedChange).value
          const originalInstance = getChangeData(originalChange)
          const originalInstanceValue = originalInstance.value
          originalInstance.value = {
            ...originalInstanceValue,
            ...appliedInstanceValue,
            // Override only the value of the fields that this filter handles
            ..._.pick(originalInstanceValue, _.flatten(Object.entries(REFERENCABLE_FIELD_NAME_TO_CONTROLLING_FIELD))),
          }
        })
      _.pullAll(changes, Object.values(relatedAppliedChanges))
      Object.values(originalChangesByFullName).forEach(change => changes.push(change))
    },
  }
}

export default filter
