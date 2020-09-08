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
import { Element, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { CPQ_PRODUCT_RULE, CPQ_PRICE_RULE, CPQ_LOOKUP_OBJECT_NAME, CPQ_LOOKUP_QUERY, CPQ_LOOKUP_PRODUCT_FIELD, CPQ_LOOKUP_MESSAGE_FIELD, CPQ_LOOKUP_REQUIRED_FIELD, CPQ_LOOKUP_TYPE_FIELD, CPQ_LOOKUP_FIELD, CPQ_RULE_LOOKUP_OBJECT_FIELD, CPQ_PRICE_ACTION, CPQ_SOURCE_LOOKUP_FIELD } from '../../constants'
import { FilterCreator } from '../../filter'
import { isInstanceOfCustomObject, apiName } from '../../transformers/transformer'
import { getCustomObjects } from '../utils'

const CPQ_LOOKUP_FIELDS = [
  CPQ_LOOKUP_PRODUCT_FIELD,
  CPQ_LOOKUP_MESSAGE_FIELD,
  CPQ_LOOKUP_REQUIRED_FIELD,
  CPQ_LOOKUP_TYPE_FIELD,
]
type FieldBasedInstanceFieldsRefContext = {
  fields: string[]
  contextField: string
}
const objectToReferencesContext: Record<string, FieldBasedInstanceFieldsRefContext> = {
  [CPQ_PRODUCT_RULE]: {
    fields: CPQ_LOOKUP_FIELDS,
    contextField: CPQ_LOOKUP_OBJECT_NAME,
  },
  [CPQ_PRICE_RULE]: {
    fields: CPQ_LOOKUP_FIELDS,
    contextField: CPQ_LOOKUP_OBJECT_NAME,
  },
  [CPQ_LOOKUP_QUERY]: {
    fields: [CPQ_LOOKUP_FIELD],
    contextField: CPQ_RULE_LOOKUP_OBJECT_FIELD,
  },
  [CPQ_PRICE_ACTION]: {
    fields: [CPQ_SOURCE_LOOKUP_FIELD],
    contextField: CPQ_RULE_LOOKUP_OBJECT_FIELD,
  },
}

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

const replaceInstanceFieldNamesValueWithRefToFieldsByOjbect = (
  instance: InstanceElement,
  apiNameToCustomObjects: Record<string, ObjectType>
): void => {
  const { fields, contextField } = objectToReferencesContext[apiName(instance.type)]
  const contextObjectName = instance.value[contextField]
  if (contextObjectName === undefined) {
    return
  }
  const contextObject = apiNameToCustomObjects[contextObjectName]
  if (contextObject === undefined) {
    return
  }
  replaceValuesWithFieldRefsByObjectContext(instance, fields, contextObject)
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
        Object.keys(objectToReferencesContext).includes(apiName(instance.type)))
    customObjectsInstanceWithFieldContextRef.forEach(instance =>
      (replaceInstanceFieldNamesValueWithRefToFieldsByOjbect(
        instance,
        apiNameToCustomObjects
      )))
  },
})

export default filter
