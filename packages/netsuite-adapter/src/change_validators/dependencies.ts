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
  Change, ChangeDataType, ChangeError, getChangeData, SeverityLevel,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { getRequiredReferencedElements } from '../reference_dependencies'

const { awu } = collections.asynciterable

type ValidityStatus = 'valid' | 'invalid' | 'unknown'

// TODO: ??? if an additional change is invalid, all depended changes must be additional changes?

// consider only additional changes as dependency-breaker changes
const getElemValidityMap = (
  invalidElementIds: string[],
  changes: ReadonlyArray<Change>
): Map<string, ValidityStatus> => {
  const additionalElemIds = changes
    .filter(change => change.action === 'add')
    .map(change => getChangeData(change).elemID.getFullName())
  const invalidAdditionalElementIds = invalidElementIds.filter(id => additionalElemIds.includes(id))

  return new Map<string, ValidityStatus>(
    invalidAdditionalElementIds.map(id => [id, 'invalid'])
  )
}

export const validateDependsOnInvalidElement = async (
  inputInvalidElementIds: string[],
  changes: ReadonlyArray<Change>,
): Promise<ReadonlyArray<ChangeError>> => {
  const elemValidity = getElemValidityMap(inputInvalidElementIds, changes)

  const isInvalid = async (element: ChangeDataType): Promise<boolean> => {
    const status = elemValidity.get(element.elemID.getFullName())
    if (status !== undefined) {
      return status === 'invalid'
    }
    // Mark validity unknown to avoid reference loops
    elemValidity.set(element.elemID.getFullName(), 'unknown')
    const elemIsInvalid = await awu((await getRequiredReferencedElements([element])))
      .some(isInvalid)
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
      message: 'Depends on an element that has errors',
      detailedMessage: `(${element.elemID.getFullName()}) depends on an element that has errors`,
    }))
    .toArray()
}
