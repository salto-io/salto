/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, Field, ReferenceExpression, ObjectType, isObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections, multiIndex } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { FIELD_ANNOTATIONS, FOREIGN_KEY_DOMAIN, CUSTOM_OBJECT, CUSTOM_OBJECT_TYPE_NAME } from '../constants'
import { apiName, metadataType, isMetadataObjectType, isCustomObject } from '../transformers/transformer'
import { apiNameSync, buildElementsSourceForFetch } from './utils'

const { makeArray } = collections.array
const { REFERENCE_TO } = FIELD_ANNOTATIONS
const { awu } = collections.asynciterable

const isMetadataTypeOrCustomObject = async (elem: Element): Promise<boolean> =>
  isMetadataObjectType(elem) || isCustomObject(elem)

/**
 * Convert annotations to reference expressions using the known metadata types.
 *
 * @param elements        The fetched elements
 * @param nameToElement   Known elements by metadata type
 * @param annotationNames List of field annotations where references may be found
 */
const convertAnnotationsToReferences = async (
  elements: Element[],
  nameToElement: multiIndex.Index<[string, string], Element>,
  annotationNames: string[],
): Promise<void> => {
  const resolveTypeReference = (ref: string | ReferenceExpression): string | ReferenceExpression => {
    if (_.isString(ref)) {
      // Try finding a metadata type and fallback to finding a custom object
      const referenceElement =
        nameToElement.get(ref, ref) ??
        nameToElement.get(CUSTOM_OBJECT, ref) ??
        nameToElement.get(CUSTOM_OBJECT_TYPE_NAME, ref)
      // SALTO-5064
      if (referenceElement !== undefined && apiNameSync(referenceElement) !== CUSTOM_OBJECT) {
        return new ReferenceExpression(referenceElement.elemID, referenceElement)
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
      annotationNames
        .filter(name => field.annotations[name] !== undefined)
        .forEach(name => {
          field.annotations[name] = makeArray(field.annotations[name]).map(resolveTypeReference)
        })
    })
}

/**
 * Convert referenceTo and foreignKeyDomain annotations into reference expressions.
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'referenceAnnotationsFilter',
  onFetch: async (elements: Element[]) => {
    const referenceElements = buildElementsSourceForFetch(elements, config)
    const nameToElement = await multiIndex.keyByAsync({
      iter: await referenceElements.getAll(),
      filter: isMetadataTypeOrCustomObject,
      key: async obj => [await metadataType(obj), await apiName(obj)],
    })
    await convertAnnotationsToReferences(elements, nameToElement, [REFERENCE_TO, FOREIGN_KEY_DOMAIN])
  },
})

export default filter
