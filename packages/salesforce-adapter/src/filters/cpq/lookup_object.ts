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
import { Element, isObjectType, ObjectType, ReferenceExpression, Value } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { isCustomObject, apiName } from '../../transformers/transformer'
import { FIELD_ANNOTATIONS, CPQ_PRODUCT_RULE, CPQ_RPICE_RULE, CPQ_LOOKUP_OBJECT_NAME } from '../../constants'

const OBJECTS_WITH_LOOKUP_OBJECT = [CPQ_PRODUCT_RULE, CPQ_RPICE_RULE]

const replaceLookupObjectValueSetValuesWithReferences = (customObjects: ObjectType[]): void => {
  const apiNameToElemID = Object.fromEntries(
    customObjects.map(object => [apiName(object), object.elemID])
  )
  const relevantObjects = customObjects
    .filter(object => OBJECTS_WITH_LOOKUP_OBJECT.includes(apiName(object)))
  relevantObjects.forEach(object => {
    const lookupObjectField = object.fields[CPQ_LOOKUP_OBJECT_NAME]
    if (lookupObjectField === undefined) {
      return
    }
    const lookupValueSet = lookupObjectField.annotations[FIELD_ANNOTATIONS.VALUE_SET]
    if (lookupValueSet === undefined) {
      return
    }
    lookupObjectField.annotations[FIELD_ANNOTATIONS.VALUE_SET] = lookupValueSet
      .map((value: Value) => {
        const fullNameVal = value.fullName
        if (fullNameVal === undefined) {
          return value
        }
        return {
          ...value,
          fullName: (apiNameToElemID[fullNameVal] !== undefined
            ? new ReferenceExpression(apiNameToElemID[fullNameVal]) : fullNameVal),
        }
      })
  })
}

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const customObjects = elements
      .filter(isObjectType)
      .filter(isCustomObject)
    replaceLookupObjectValueSetValuesWithReferences(customObjects)
  },
})

export default filter
