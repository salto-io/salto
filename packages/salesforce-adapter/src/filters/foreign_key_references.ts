/*
*                      Copyright 2021 Salto Labs Ltd.
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
  Element, InstanceElement, ReferenceExpression,
  isInstanceElement, isReferenceExpression, ElemID,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { transformValues, TransformFunc } from '@salto-io/adapter-utils'
import { values, collections, multiIndex } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { FOREIGN_KEY_DOMAIN } from '../constants'
import { metadataType, apiName } from '../transformers/transformer'
import { buildElementsSourceForFetch, extractFlatCustomObjectFields, hasApiName } from './utils'

const { makeArray } = collections.array
const { flatMapAsync } = collections.asynciterable

/**
 * Resolve references using the mapping generated from the Salesforce DescribeValueType API.
 *
 * @param instance                The current instance being modified
 * @param externalIDToElemIDs     Known element ids, mapped by API name and metadata type
 */
const resolveReferences = (
  instance: InstanceElement,
  externalIDToElemIDs: multiIndex.Index<[string, string], ElemID>,
): void => {
  const transformPrimitive: TransformFunc = ({ value, field }) => {
    if (field === undefined || value === undefined || !_.isString(value)) {
      return value
    }

    const refTarget = makeArray(field.annotations[FOREIGN_KEY_DOMAIN])
      .filter(isReferenceExpression)
      .map(ref => externalIDToElemIDs.get(ref.elemId.typeName, value))
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

/**
 * Use annotations generated from the DescribeValueType API foreignKeyDomain data to resolve
 * names into reference expressions.
 */
const filter: FilterCreator = ({ config }) => ({
  onFetch: async (elements: Element[]) => {
    const referenceElements = buildElementsSourceForFetch(elements, config)
    const elementsWithFields = flatMapAsync(
      await referenceElements.getAll(),
      extractFlatCustomObjectFields,
    )
    const elementIndex = await multiIndex.keyByAsync({
      iter: elementsWithFields,
      filter: hasApiName,
      key: elem => [metadataType(elem), apiName(elem)],
      map: elem => elem.elemID,
    })
    elements.filter(isInstanceElement).forEach(instance => {
      resolveReferences(instance, elementIndex)
    })
  },
})

export default filter
