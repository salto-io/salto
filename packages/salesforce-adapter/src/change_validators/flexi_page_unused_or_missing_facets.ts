/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import {
  ChangeError,
  ChangeValidator,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { TransformFuncSync, transformValuesSync } from '@salto-io/adapter-utils'
import { FLEXI_PAGE_TYPE } from '../constants'
import { isInstanceOfTypeSync } from '../filters/utils'

const { DefaultMap } = collections.map

const getFacetDefinitionsAndReferences = (
  element: InstanceElement,
): { facetDefinitions: Record<string, ElemID>; facetReferences: Map<string, ElemID[]> } => {
  const facetDefinitions: Record<string, ElemID> = {}
  const facetReferences = new DefaultMap<string, ElemID[]>(() => [])
  const findDefinitionsAndReferences: TransformFuncSync = ({ value, path, field }) => {
    if (field === undefined || path === undefined) return value
    if (field.name === 'flexiPageRegions' && _.get(value, 'type') === 'Facet' && _.isString(_.get(value, 'name'))) {
      facetDefinitions[value.name] = path
    }
    if (path.name === 'value' && _.isString(value) && value.startsWith('Facet-')) {
      facetReferences.get(value).push(path)
    }
    return value
  }
  transformValuesSync({
    values: element.value,
    pathID: element.elemID,
    type: element.getTypeSync(),
    transformFunc: findDefinitionsAndReferences,
  })
  return { facetDefinitions, facetReferences }
}

const getUnusedFacetsAndMissingReferences = ({
  facetDefinitions,
  facetReferences,
}: {
  facetDefinitions: Record<string, ElemID>
  facetReferences: Map<string, ElemID[]>
}): { unusedFacets: Record<string, ElemID>; missingReferences: Map<string, ElemID[]> } => {
  const unusedFacets: Record<string, ElemID> = {}
  const missingReferences = new DefaultMap<string, ElemID[]>(() => [])
  Object.keys(facetDefinitions).forEach(elem => {
    if (!facetReferences.has(elem)) unusedFacets[elem] = facetDefinitions[elem]
  })
  facetReferences.forEach((elemId, elem) => {
    if (_.isUndefined(facetDefinitions[elem])) missingReferences.set(elem, elemId)
  })
  return { unusedFacets, missingReferences }
}

const createMissingReferencedFacetChangeError = (elemId: ElemID, elemName: string): ChangeError => ({
  elemID: elemId,
  severity: 'Warning',
  message: 'Reference to missing Facet',
  detailedMessage: `The Facet "${elemName}" does not exist.`,
})

const createUnusedFacetChangeError = (elemId: ElemID, elemName: string): ChangeError => ({
  elemID: elemId,
  severity: 'Warning',
  message: 'Unused Facet',
  detailedMessage: `The Facet "${elemName}" isn’t being used in the Flow.`,
})

const createChangeErrors = ({
  facetDefinitions,
  facetReferences,
}: {
  facetDefinitions: Record<string, ElemID>
  facetReferences: Map<string, ElemID[]>
}): ChangeError[] => {
  const { unusedFacets, missingReferences } = getUnusedFacetsAndMissingReferences({ facetDefinitions, facetReferences })
  const unusedFacetErrors = Object.entries(unusedFacets).map(([name, elemId]) =>
    createUnusedFacetChangeError(elemId, name),
  )
  const missingReferenceErrors = Array.from(missingReferences.entries()).flatMap(([name, elemIds]) =>
    elemIds.map(elemId => createMissingReferencedFacetChangeError(elemId, name)),
  )
  return [...unusedFacetErrors, ...missingReferenceErrors]
}

const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(FLEXI_PAGE_TYPE))
    .map(getFacetDefinitionsAndReferences)
    .flatMap(createChangeErrors)

export default changeValidator
