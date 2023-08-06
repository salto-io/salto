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

import { InstanceElement, getChangeData, isAdditionChange, isAdditionOrModificationChange, isInstanceElement, ChangeError } from '@salto-io/adapter-api'
import { WALK_NEXT_STEP, WalkOnFunc, walkOnElement } from '@salto-io/adapter-utils'
import { NetsuiteChangeValidator } from './types'

const fileIsReferenced = (
  changes: InstanceElement[],
  file: InstanceElement
): boolean => {
  const fullName = file.elemID.getFullName()
  let answer = false

  const func: WalkOnFunc = ({ value }) => {
    if (value.elemID?.createTopLevelParentID().parent.getFullName() === fullName) {
      answer = true
      return WALK_NEXT_STEP.EXIT
    }
    return WALK_NEXT_STEP.RECURSE
  }

  changes.some(element => {
    if (!file.isEqual(element)) {
      walkOnElement({ element, func })
    }
    return answer
  })

  return answer
}
const changeValidator: NetsuiteChangeValidator = async (changes, _deployReferencedElements, _elementsSource) => {
  const instanceElementChanges = changes
    .filter(isAdditionOrModificationChange)
    .map(change => getChangeData(change))
    .filter(isInstanceElement)
  const fileAdditions = changes
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(change => change.elemID.typeName === 'file')
  const unreferencedFiles = fileAdditions
    .filter(file => !fileIsReferenced(instanceElementChanges, file))
  const res = unreferencedFiles
    .map(({ elemID }): ChangeError => ({
      elemID,
      severity: 'Warning',
      message: 'This file is not referenced by any element',
      detailedMessage: 'Usually files are referenced by an element, it is possible that you forgot to deploy the relevant element',
    }))
  return res
}

export default changeValidator
