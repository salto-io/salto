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

import { ChangeDataType, ElemID, getChangeData } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
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
      const referencedElements = await getReferencedElements(
        [element], deployAllReferencedElements
      )
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

const changeValidator: NetsuiteChangeValidator = async (changes, deployReferencedElements = false) => {
  const refererToReferenceElements = await getReferencedElementsForReferrers(
    changes.map(getChangeData), deployReferencedElements
  )

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
