/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Element,
  InstanceElement,
  ReferenceExpression,
  isInstanceElement,
  isReferenceExpression,
  ElemID,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { transformValues, TransformFunc } from '@salto-io/adapter-utils'
import { values, collections, multiIndex } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { FOREIGN_KEY_DOMAIN } from '../constants'
import { metadataType, apiName } from '../transformers/transformer'
import { buildElementsSourceForFetch, extractFlatCustomObjectFields, hasApiName } from './utils'

const { awu } = collections.asynciterable

const { makeArray } = collections.array
const { flatMapAsync } = collections.asynciterable

/**
 * Resolve references using the mapping generated from the Salesforce DescribeValueType API.
 *
 * @param instance                The current instance being modified
 * @param externalIDToElemIDs     Known element ids, mapped by API name and metadata type
 */
const resolveReferences = async (
  instance: InstanceElement,
  externalIDToElemIDs: multiIndex.Index<[string, string], ElemID>,
): Promise<void> => {
  const transformPrimitive: TransformFunc = ({ value, field }) => {
    if (field === undefined || value === undefined || !_.isString(value)) {
      return value
    }

    const refTarget = makeArray(field.annotations[FOREIGN_KEY_DOMAIN])
      .filter(isReferenceExpression)
      .map(ref => externalIDToElemIDs.get(ref.elemID.typeName, value))
      .find(values.isDefined)
    return refTarget !== undefined ? new ReferenceExpression(refTarget) : value
  }

  // not using transformElement because we're editing the instance in-place
  instance.value =
    (await transformValues({
      values: instance.value,
      type: await instance.getType(),
      transformFunc: transformPrimitive,
      strict: false,
      allowEmptyArrays: true,
      allowEmptyObjects: true,
    })) ?? instance.value
}

/**
 * Use annotations generated from the DescribeValueType API foreignKeyDomain data to resolve
 * names into reference expressions.
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'foreignKeyReferencesFilter',
  onFetch: async (elements: Element[]) => {
    const referenceElements = buildElementsSourceForFetch(elements, config)
    const elementsWithFields = flatMapAsync(await referenceElements.getAll(), extractFlatCustomObjectFields)
    const elementIndex = await multiIndex.keyByAsync({
      iter: elementsWithFields,
      filter: hasApiName,
      key: async elem => [await metadataType(elem), await apiName(elem)],
      map: elem => elem.elemID,
    })
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async instance => {
        await resolveReferences(instance, elementIndex)
      })
  },
})

export default filter
