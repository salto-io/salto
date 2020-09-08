/*
*                      Copyright 2020 Salto Labs Ltd.
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
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { Element, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { CPQ_PRODUCT_RULE, CPQ_PRICE_RULE, CPQ_LOOKUP_OBJECT_NAME, CPQ_LOOKUP_QUERY, CPQ_LOOKUP_DATA, CPQ_LOOKUP_PRODUCT_FIELD, CPQ_LOOKUP_MESSAGE_FIELD, CPQ_LOOKUP_REQUIRED_FIELD, CPQ_LOOKUP_TYPE_FIELD, CPQ_LOOKUP_FIELD } from '../../constants'
import { FilterCreator } from '../../filter'
import { isInstanceOfCustomObject, apiName } from '../../transformers/transformer'
import { getCustomObjects } from '../utils'

const { isDefined } = values

const CPQ_LOOKUP_FIELDS = [
  CPQ_LOOKUP_PRODUCT_FIELD,
  CPQ_LOOKUP_MESSAGE_FIELD,
  CPQ_LOOKUP_REQUIRED_FIELD,
  CPQ_LOOKUP_TYPE_FIELD,
]
type FieldBasedinstanceFieldsRefContext = {
  fields: string[]
  contextField: string
}
type InstanceFieldsRefContext = {
  fields: string[]
  contextObjectName: string
}
const mappingWithFieldBasedContext: Record<string, FieldBasedinstanceFieldsRefContext> = {
  [CPQ_PRODUCT_RULE]: {
    fields: CPQ_LOOKUP_FIELDS,
    contextField: CPQ_LOOKUP_OBJECT_NAME,
  },
  [CPQ_PRICE_RULE]: {
    fields: CPQ_LOOKUP_FIELDS,
    contextField: CPQ_LOOKUP_OBJECT_NAME,
  },
}

const mappingWithKnownContext: Record<string, InstanceFieldsRefContext> = {
  [CPQ_LOOKUP_QUERY]: {
    fields: [CPQ_LOOKUP_FIELD],
    contextObjectName: CPQ_LOOKUP_DATA,
  },
}

const groupByTypeApiName = (instances: InstanceElement[]): Record<string, InstanceElement[]> =>
  (_.groupBy(
    instances,
    instance => apiName(instance.type)
  ))

const replaceValuesWithFieldRefsByObjectContext = (
  instance: InstanceElement,
  fields: string[],
  contextObject: ObjectType
): void => {
  fields.forEach(fieldName => {
    const objectField = contextObject.fields[instance.value[fieldName]]
    if (objectField === undefined) {
      return
    }
    instance.value[fieldName] = new ReferenceExpression(objectField.elemID)
  })
}

const getKnownTypeContext = (
  typeName: string,
  apiNameToCustomObjects: Record<string, ObjectType>
): { fields: string[]; contextObject: ObjectType } | undefined => {
  const knownContext = mappingWithKnownContext[typeName]
  if (knownContext === undefined) {
    return undefined
  }
  const contextObject = apiNameToCustomObjects[knownContext.contextObjectName]
  if (contextObject === undefined) {
    return undefined
  }
  return {
    fields: knownContext.fields,
    contextObject,
  }
}

const getFieldBasedInstanceContext = (
  typeName: string,
  instance: InstanceElement,
  apiNameToCustomObjects: Record<string, ObjectType>
): { fields: string[]; contextObject: ObjectType; instance: InstanceElement } | undefined => {
  const fieldBasedContext = mappingWithFieldBasedContext[typeName]
  if (fieldBasedContext === undefined
      || instance.value[fieldBasedContext.contextField] === undefined) {
    return undefined
  }
  const contextObjectName = instance.value[fieldBasedContext.contextField]
  const contextObject = contextObjectName === undefined
    ? undefined : apiNameToCustomObjects[contextObjectName]
  return contextObject === undefined ? undefined : {
    fields: fieldBasedContext.fields,
    contextObject,
    instance,
  }
}

const replaceFieldNamesWithKnownContextRef = (
  instances: InstanceElement[],
  apiNameToCustomObjects: Record<string, ObjectType>
): void => {
  const typeApiNameToInstances = groupByTypeApiName(instances)
  const typeApiNameToRefsContext = Object.fromEntries(
    Object.keys(typeApiNameToInstances).map(typeName => {
      const typeContext = getKnownTypeContext(typeName, apiNameToCustomObjects)
      return typeContext === undefined ? undefined : [typeName, typeContext]
    }).filter(isDefined)
  )
  Object.entries(typeApiNameToInstances).forEach(([typeName, typeInstances]) => {
    const typeContext = typeApiNameToRefsContext[typeName]
    if (typeContext === undefined) {
      return
    }
    typeInstances.forEach(instance =>
      replaceValuesWithFieldRefsByObjectContext(
        instance,
        typeContext.fields,
        typeContext.contextObject
      ))
  })
}

const replaceFieldNamesWithFieldContextRef = (
  instances: InstanceElement[],
  apiNameToCustomObjects: Record<string, ObjectType>
): void => {
  const typeApiNameToInstances = groupByTypeApiName(instances)
  Object.entries(typeApiNameToInstances)
    .flatMap(([typeName, typeInstances]) =>
      (typeInstances
        .map(instance => (getFieldBasedInstanceContext(typeName, instance, apiNameToCustomObjects)))
        .filter(isDefined)))
    .forEach(instanceContext =>
      replaceValuesWithFieldRefsByObjectContext(
        instanceContext.instance,
        instanceContext.fields,
        instanceContext.contextObject
      ))
}


const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const customObjects = getCustomObjects(elements)
    const apiNameToCustomObjects = Object.fromEntries(
      customObjects.map(object => [apiName(object), object])
    )
    const customObjectInstances = elements
      .filter(isInstanceOfCustomObject)
    const customObjectsInstanceWithFieldContextRef = customObjectInstances
      .filter(instance =>
        Object.keys(mappingWithFieldBasedContext).includes(apiName(instance.type)))
    const customObjectsInstanceWithKnownContextRef = customObjectInstances
      .filter(instance =>
        Object.keys(mappingWithKnownContext).includes(apiName(instance.type)))
    replaceFieldNamesWithFieldContextRef(
      customObjectsInstanceWithFieldContextRef,
      apiNameToCustomObjects
    )
    replaceFieldNamesWithKnownContextRef(
      customObjectsInstanceWithKnownContextRef,
      apiNameToCustomObjects,
    )
  },
})

export default filter
