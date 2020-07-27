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
import {
  ElemID, Element, isObjectType, InstanceElement, ReferenceExpression,
  isInstanceElement, isReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { transformValues, TransformFunc } from '@salto-io/adapter-utils'
import { values, collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { groupByAPIName, ApiNameMapping } from './instance_references'
import { FOREIGN_KEY_DOMAIN } from '../constants'
import { apiName } from '../transformers/transformer'

const { makeArray } = collections.array

/**
 * Convert foreign-key-domain annotations to reference expressions using the known metadata types.
 *
 * @param elements      The fetched elements
 * @param typeToElemID  Known element ids by metadata type
 */
const convertAnnotationsToReferences = (
  elements: Element[],
  typeToElemID: Record<string, ElemID>,
): void => {
  const resolveTypeReference = (ref: string | ReferenceExpression):
    string | ReferenceExpression => {
    if (_.isString(ref)) {
      const referenceElemId = typeToElemID[ref]
      if (referenceElemId !== undefined) {
        return new ReferenceExpression(referenceElemId)
      }
    }
    return ref
  }

  elements
    .filter(isObjectType)
    .flatMap(obj => Object.values(obj.fields))
    .filter(field => field.annotations[FOREIGN_KEY_DOMAIN] !== undefined)
    .forEach(field => {
      field.annotations[FOREIGN_KEY_DOMAIN] = field.annotations[FOREIGN_KEY_DOMAIN]
        .map(resolveTypeReference)
    })
}

/**
 * Resolve references using the mapping genrated from the Salesforce DescribeValueType API.
 *
 * @param instance                The current instance being modified
 * @param apiNameToElemIDs        Known element ids, mapped by API name and metadata type
 */
const resolveReferences = (
  instance: InstanceElement,
  apiNameToElemIDs: ApiNameMapping,
): void => {
  const transformPrimitive: TransformFunc = ({ value, field }) => {
    if (field === undefined || value === undefined || !_.isString(value)) {
      return value
    }

    const refTarget = makeArray(field.annotations[FOREIGN_KEY_DOMAIN])
      .filter(isReferenceExpression)
      .map((ref: ReferenceExpression) => apiNameToElemIDs[value]?.[
        ref.elemId.typeName
      ])
      .find(values.isDefined)
    return refTarget !== undefined ? new ReferenceExpression(refTarget) : value
  }

  // not using transformElement because we're editing the instance in-place
  instance.value = transformValues({
    values: instance.value,
    type: instance.type,
    transformFunc: transformPrimitive,
    strict: false,
  }) ?? instance.value
}

export const apiNameToElemID = (elements: Element[]): Record<string, ElemID> => (
  Object.fromEntries(
    elements
      .filter(isObjectType)
      .map(e => [apiName(e), e.elemID])
  )
)

/**
 * Use annotations generated from the DescribeValueType API foreignKeyDomain data to resolve
 * names into reference expressions.
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const typeToElemID = apiNameToElemID(elements)
    convertAnnotationsToReferences(elements, typeToElemID)

    const apiNameToElemIDs = groupByAPIName(elements)
    elements.filter(isInstanceElement).forEach(instance => {
      resolveReferences(instance, apiNameToElemIDs)
    })
  },
})

export default filter
