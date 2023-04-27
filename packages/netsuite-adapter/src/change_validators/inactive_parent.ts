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

import { AdditionChange, Change, ChangeError, InstanceElement, ModificationChange, ReadOnlyElementsSource, getChangeData, isAdditionOrModificationChange, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { isUndefined } from 'lodash'
import { isDataObjectType, isCustomRecordType } from '../types'
import { NetsuiteChangeValidator } from './types'

const { awu } = collections.asynciterable
const { isDefined } = values

const IS_INACTIVE_FIELD = 'isInactive'

const isDataElement = async (change: Change<InstanceElement>): Promise<boolean> => {
  const changeType = await getChangeData(change).getType()
  return isDataObjectType(changeType) && !isCustomRecordType(changeType)
}

const getParentIdentifier = (elem: InstanceElement): string | undefined => elem.value.parent?.elemID.getFullName()

const hasNewParent = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>
): boolean => {
  const parentIdentifierBefore = isModificationChange(change) ? getParentIdentifier(change.data.before) : undefined
  return parentIdentifierBefore !== getParentIdentifier(change.data.after)
}

const hasInactiveParent = async (
  change: InstanceElement,
  elementsSource: ReadOnlyElementsSource
): Promise<boolean> =>
  (isDefined(change.value.parent)
    ? ((await elementsSource.get(change.value.parent.elemID.createNestedID(IS_INACTIVE_FIELD))) ?? false) : false)

const changeValidator: NetsuiteChangeValidator = async (changes, _deployReferencedElements, elementsSource) => {
  if (isUndefined(elementsSource)) {
    return []
  }

  return awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(isDataElement)
    .filter(hasNewParent)
    .map(getChangeData)
    .filter(change => hasInactiveParent(change, elementsSource))
    .map(({ elemID }): ChangeError => ({
      elemID,
      severity: 'Error',
      message: 'Inactive parent assigned.',
      detailedMessage: 'Can\'t deploy this element because its newly assigned parent is inactive.'
        + ' To deploy it, activate its parent.',
    }))
    .toArray()
}

export default changeValidator
