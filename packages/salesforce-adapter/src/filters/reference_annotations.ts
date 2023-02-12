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
  ElemID, Element, Field, ReferenceExpression, ObjectType, isObjectType,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections, multiIndex } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { FIELD_ANNOTATIONS, FOREIGN_KEY_DOMAIN, CUSTOM_OBJECT } from '../constants'
import { apiName, metadataType, isMetadataObjectType, isCustomObject } from '../transformers/transformer'
import { buildElementsSourceForFetch } from './utils'

const { makeArray } = collections.array
const { REFERENCE_TO } = FIELD_ANNOTATIONS
const { awu } = collections.asynciterable

const isMetadataTypeOrCustomObject = async (elem: Element): Promise<boolean> => (
  isMetadataObjectType(elem) || isCustomObject(elem)
)

/**
 * Convert annotations to reference expressions using the known metadata types.
 *
 * @param elements      The fetched elements
 * @param typeToElemID  Known element ids by metadata type
 */
const convertAnnotationsToReferences = async (
  elements: Element[],
  typeToElemID: multiIndex.Index<[string, string], ElemID>,
  annotationNames: string[],
): Promise<void> => {
  const resolveTypeReference = (ref: string | ReferenceExpression):
    string | ReferenceExpression => {
    if (_.isString(ref)) {
      // Try finding a metadata type and fallback to finding a custom object
      const referenceElemId = typeToElemID.get(ref, ref) ?? typeToElemID.get(CUSTOM_OBJECT, ref)
      if (referenceElemId !== undefined) {
        return new ReferenceExpression(referenceElemId)
      }
    }
    return ref
  }

  await awu(elements)
    .filter(isObjectType)
    .filter(isMetadataTypeOrCustomObject)
    .flatMap((obj: ObjectType) => Object.values(obj.fields))
    .filter((field: Field) => annotationNames.some(name => field.annotations[name] !== undefined))
    .forEach((field: Field): void => {
      annotationNames.filter(name => field.annotations[name] !== undefined).forEach(name => {
        field.annotations[name] = makeArray(field.annotations[name]).map(resolveTypeReference)
      })
    })
}

/**
 * Convert referenceTo and foreignKeyDomain annotations into reference expressions.
 */
const filter: LocalFilterCreator = ({ config }) => ({
  name: 'referenceAnnotationsFilter',
  onFetch: async (elements: Element[]) => {
    const referenceElements = buildElementsSourceForFetch(elements, config)
    const typeToElemID = await multiIndex.keyByAsync({
      iter: await referenceElements.getAll(),
      filter: isMetadataTypeOrCustomObject,
      key: async obj => [await metadataType(obj), await apiName(obj)],
      map: obj => obj.elemID,
    })
    await convertAnnotationsToReferences(elements, typeToElemID, [REFERENCE_TO, FOREIGN_KEY_DOMAIN])
  },
})

export default filter
