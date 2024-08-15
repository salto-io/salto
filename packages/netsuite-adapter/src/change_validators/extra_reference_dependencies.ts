/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { ChangeDataType, ElemID, getChangeData, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { isStandardInstanceOrCustomRecordType } from '../types'
import { getReferencedElements } from '../reference_dependencies'
import { NetsuiteChangeValidator } from './types'

const { awu } = collections.asynciterable
const { isDefined } = values

type ElementToReferenceElements = {
  sourceElementID: ElemID
  references: string
  referencesNumber: number
}

export const getReferencedElementsForReferrers = async (
  elements: ChangeDataType[],
  deployAllReferencedElements: boolean,
): Promise<ElementToReferenceElements[]> => {
  const sourceElemIdSet = new Set(elements.map(element => element.elemID.getFullName()))
  return awu(elements)
    .map(async element => {
      const referencedElements = await getReferencedElements([element], deployAllReferencedElements)
      const references = referencedElements
        .filter(referencedElement => !sourceElemIdSet.has(referencedElement.elemID.getFullName()))
        .map(referencedElement => referencedElement.elemID.getFullName())
      if (references.length === 0) {
        return undefined
      }
      return {
        sourceElementID: element.elemID,
        references: references.join(', '),
        referencesNumber: references.length,
      }
    })
    .filter(isDefined)
    .toArray()
}

const changeValidator: NetsuiteChangeValidator = async (changes, { deployReferencedElements }) => {
  const sdfChangesData = changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isStandardInstanceOrCustomRecordType)

  const refererToReferenceElements = await getReferencedElementsForReferrers(sdfChangesData, deployReferencedElements)

  return refererToReferenceElements.map(refererToReferenceElement => {
    const pluralRefElement = refererToReferenceElement.referencesNumber > 1 ? 's' : ''
    const pluralPronoun = refererToReferenceElement.referencesNumber > 1 ? 'them' : 'it'

    return {
      elemID: refererToReferenceElement.sourceElementID,
      severity: 'Warning',
      message: `This element requires additional element${pluralRefElement} to be deployed. Salto will automatically deploy ${pluralPronoun}`,
      detailedMessage: `This element requires the following element${pluralRefElement} to be deployed as well: ${refererToReferenceElement.references}. Salto will automatically deploy ${pluralPronoun} as part of this deployment`,
    }
  })
}

export default changeValidator
