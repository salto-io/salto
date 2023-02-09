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
import _ from 'lodash'
import { Element, isInstanceElement, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { multiIndex, collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { transformValues, TransformFunc } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable
const { isPlainRecord } = lowerdashValues
const { ADDITIONAL_PROPERTIES_FIELD } = elementUtils.swagger

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
const isInstanceElementWithSelfLink = (elem: Element): elem is InstanceElementWithSelfLink => (
  isInstanceElement(elem) && hasSelfLink(elem.value)
)

const getRelativeSelfLink = (obj: ObjectWithSelfLink): string => {
  const fullLink = getSelfLink(obj)
  const selfLink = new URL(fullLink)
  // We take only the part of the link after the api version
  // we expect the pathname to be in the form of "/<rest or agile>/api/<version number>/..."
  return selfLink.pathname.split('/').slice(4).join('/')
}

const transformSelfLinkToReference = (
  elementsBySelfLink: multiIndex.Index<[string], InstanceElementWithSelfLink>
): TransformFunc => ({ value, path }) => {
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
    await awu(instances).forEach(async inst => {
      inst.value = await transformValues({
        values: inst.value,
        type: await inst.getType(),
        pathID: inst.elemID,
        transformFunc: transformSelfLinkToReference(elementsBySelfLink),
        strict: false,
        allowEmpty: true,
      }) ?? inst.value
    })
  },
})

export default filter
