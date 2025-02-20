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
import {
  COMPONENT_INSTANCE_PROPERTY_FIELD_NAMES,
  FLEXI_PAGE_FIELD_NAMES,
  FLEXI_PAGE_REGION_FIELD_NAMES,
  FLEXI_PAGE_TYPE,
  LIGHTNING_PAGE_TYPE,
  PAGE_REGION_TYPE_VALUES,
} from '../constants'
import { isInstanceOfTypeSync } from '../filters/utils'

const { DefaultMap } = collections.map

type FlexiPageRegion = {
  type: string
  name: string
}

const isFlexiPageRegion = (instance: unknown): instance is FlexiPageRegion =>
  _.get(instance, FLEXI_PAGE_REGION_FIELD_NAMES.TYPE) === PAGE_REGION_TYPE_VALUES.FACET &&
  _.isString(_.get(instance, FLEXI_PAGE_REGION_FIELD_NAMES.NAME))

const isFacetReference = (value: unknown): value is string => _.isString(value) && value.startsWith('Facet-')

const getFacetDefinitionsAndReferences = (
  element: InstanceElement,
): { facetDefinitions: Record<string, ElemID>; facetReferences: Map<string, ElemID[]> } => {
  const facetDefinitions: Record<string, ElemID> = {}
  const potentialFacetReferences = new DefaultMap<string, ElemID[]>(() => [])
  const findDefinitionsAndReferences: TransformFuncSync = ({ value, path, field }) => {
    if (field === undefined || path === undefined) return value
    if (field.name === FLEXI_PAGE_FIELD_NAMES.FLEXI_PAGE_REGIONS && isFlexiPageRegion(value)) {
      facetDefinitions[value.name] = path
    }
    if (path.name === COMPONENT_INSTANCE_PROPERTY_FIELD_NAMES.VALUE) {
      potentialFacetReferences.get(value).push(path)
    }
    return value
  }
  transformValuesSync({
    values: element.value,
    pathID: element.elemID,
    type: element.getTypeSync(),
    transformFunc: findDefinitionsAndReferences,
  })
  const facetReferences = new Map(
    [...potentialFacetReferences.entries()].filter(([key]) => isFacetReference(key) || key in facetDefinitions),
  )
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
  detailedMessage: `The Facet "${elemName}" isn’t being used in the ${LIGHTNING_PAGE_TYPE}.`,
})

const createChangeErrors = (element: InstanceElement): ChangeError[] => {
  const { facetDefinitions, facetReferences } = getFacetDefinitionsAndReferences(element)
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
    .flatMap(createChangeErrors)

export default changeValidator
