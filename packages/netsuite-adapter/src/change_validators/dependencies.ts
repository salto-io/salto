/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { Change, ChangeDataType, ChangeError, getChangeData, SeverityLevel } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { findDependingElementsFromRefs, getRequiredReferencedElements } from '../reference_dependencies'

const { awu } = collections.asynciterable

type ValidityStatus = 'valid' | 'invalid' | 'unknown'

export const validateDependsOnInvalidElement = async (
  inputInvalidElementIds: readonly string[],
  changes: ReadonlyArray<Change>,
): Promise<ReadonlyArray<ChangeError>> => {
  const additionalElemIds = new Set(
    changes.filter(change => change.action === 'add').map(change => getChangeData(change).elemID.getFullName()),
  )
  const elemValidity = new Map<string, ValidityStatus>(inputInvalidElementIds.map(id => [id, 'invalid']))

  const isInvalid = async (element: ChangeDataType): Promise<boolean> => {
    const status = elemValidity.get(element.elemID.getFullName())
    if (status !== undefined) {
      return status === 'invalid'
    }
    // Mark validity unknown to avoid reference loops
    elemValidity.set(element.elemID.getFullName(), 'unknown')

    const requiredReferences = (await findDependingElementsFromRefs(element))
      // only additional changes considers required references
      .filter(refElem => additionalElemIds.has(refElem.elemID.getFullName()))
      // also references to required elements
      .concat(await getRequiredReferencedElements([element]))
    const elemIsInvalid = await awu(requiredReferences).some(isInvalid)
    // Remember final validity decision to avoid checking this instance again
    elemValidity.set(element.elemID.getFullName(), elemIsInvalid ? 'invalid' : 'valid')
    return elemIsInvalid
  }

  return awu(changes)
    .map(getChangeData)
    .filter(element => !inputInvalidElementIds.includes(element.elemID.getFullName()))
    .filter(isInvalid)
    .map(element => ({
      elemID: element.elemID,
      severity: 'Error' as SeverityLevel,
      message: "Can't deploy due to a dependency on an element with errors",
      detailedMessage:
        "This element can't be deployed since it depends on an element that has errors.\n" +
        'You can either resolve the errors or edit this element in Salto to remove the dependency and then try to deploy this change again. Alternatively, you can remove this change from Salto and change it directly in the NetSuite UI.',
    }))
    .toArray()
}
