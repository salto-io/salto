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
  ElemID, Element, Field, isObjectType, ReferenceExpression, ObjectType,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { FIELD_ANNOTATIONS, FOREIGN_KEY_DOMAIN } from '../constants'
import { apiName } from '../transformers/transformer'

const { makeArray } = collections.array
const { REFERENCE_TO } = FIELD_ANNOTATIONS

/**
 * Convert annotations to reference expressions using the known metadata types.
 *
 * @param elements      The fetched elements
 * @param typeToElemID  Known element ids by metadata type
 */
const convertAnnotationsToReferences = (
  elements: Element[],
  typeToElemID: Record<string, ElemID>,
  annotationNames: string[],
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
    .flatMap((obj: ObjectType) => Object.values(obj.fields))
    .filter((field: Field) => annotationNames.some(name => field.annotations[name] !== undefined))
    .forEach((field: Field): void => {
      annotationNames.filter(name => field.annotations[name] !== undefined).forEach(name => {
        field.annotations[name] = makeArray(field.annotations[name]).map(resolveTypeReference)
      })
    })
}

export const apiNameToElemID = (elements: Element[]): Record<string, ElemID> => (
  Object.fromEntries(
    elements
      .filter(isObjectType)
      .map(e => [apiName(e), e.elemID])
  )
)

/**
 * Convert referenceTo and foreignKeyDomain annotations into reference expressions.
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const typeToElemID = apiNameToElemID(elements)
    convertAnnotationsToReferences(elements, typeToElemID, [REFERENCE_TO, FOREIGN_KEY_DOMAIN])
  },
})

export default filter
