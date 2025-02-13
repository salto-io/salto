/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Element, isInstanceElement, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { multiIndex, collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { TransformFunc, transformValuesSync } from '@salto-io/adapter-utils'
import { openapi } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable
const { isPlainRecord } = lowerdashValues
const { ADDITIONAL_PROPERTIES_FIELD } = openapi

type ObjectWithSelfLink = { self: string } | { [ADDITIONAL_PROPERTIES_FIELD]: { self: string } }

function getSelfLink(obj: ObjectWithSelfLink): string
function getSelfLink(obj: unknown): string | undefined
function getSelfLink(obj: unknown): string | undefined {
  if (!isPlainRecord(obj)) {
    return undefined
  }
  if (_.isString(obj.self)) {
    return obj.self
  }
  const additionalProperties = obj[ADDITIONAL_PROPERTIES_FIELD]
  if (isPlainRecord(additionalProperties) && _.isString(additionalProperties.self)) {
    return additionalProperties.self
  }
  return undefined
}

const hasSelfLink = (obj: unknown): obj is ObjectWithSelfLink => getSelfLink(obj) !== undefined

type InstanceElementWithSelfLink = InstanceElement & {
  value: InstanceElement['value'] & ObjectWithSelfLink
}
const isInstanceElementWithSelfLink = (elem: Element): elem is InstanceElementWithSelfLink =>
  isInstanceElement(elem) && hasSelfLink(elem.value)

const getRelativeSelfLink = (obj: ObjectWithSelfLink): string => {
  const fullLink = getSelfLink(obj)
  const selfLink = new URL(fullLink)
  // We take only the part of the link after the api version
  // we expect the pathname to be in the form of "/<rest or agile>/api/<version number>/..."
  return selfLink.pathname.split('/').slice(4).join('/')
}

const transformSelfLinkToReference =
  (elementsBySelfLink: multiIndex.Index<[string], InstanceElementWithSelfLink>): TransformFunc =>
  ({ value, path }) => {
    if (path && path.isTopLevel()) {
      // Skip the top level value as we should not replace the instance content
      // with a reference to itself
      return value
    }
    if (hasSelfLink(value)) {
      const target = elementsBySelfLink.get(getRelativeSelfLink(value))
      if (target !== undefined) {
        return new ReferenceExpression(target.elemID, target)
      }
    }
    return value
  }

/**
 * Adds references from every nested element that contains a "self" link
 * to a top level element with the same self link
 */
const filter: FilterCreator = () => ({
  name: 'referenceBySelfLinkFilter',
  onFetch: async (elements: Element[]) => {
    const instances = elements.filter(isInstanceElement)

    const elementsBySelfLink = await multiIndex.keyByAsync({
      iter: awu(instances),
      filter: isInstanceElementWithSelfLink,
      key: inst => [getRelativeSelfLink(inst.value)],
    })
    instances.forEach(inst => {
      inst.value =
        transformValuesSync({
          values: inst.value,
          type: inst.getTypeSync(),
          pathID: inst.elemID,
          transformFunc: transformSelfLinkToReference(elementsBySelfLink),
          strict: false,
          allowEmptyArrays: true,
          allowExistingEmptyObjects: true,
        }) ?? inst.value
    })
  },
})

export default filter
