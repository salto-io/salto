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

import {
  AdditionChange,
  Change,
  ChangeError,
  InstanceElement,
  ModificationChange,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isDataObjectType, isCustomRecordType } from '../types'
import { NetsuiteChangeValidator } from './types'
import { INACTIVE_FIELDS, PARENT } from '../constants'

const { awu } = collections.asynciterable

const isDataElementChange = async (change: Change<InstanceElement>): Promise<boolean> => {
  const changeType = await getChangeData(change).getType()
  return isDataObjectType(changeType) && !isCustomRecordType(changeType) // custom record types don't have inactive parent limitation on NetSuite
}

const getParentIdentifier = (elem: InstanceElement): string | undefined =>
  isReferenceExpression(elem.value[PARENT]) ? elem.value[PARENT].elemID.getFullName() : undefined

const hasNewParent = (change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>): boolean => {
  const parentIdentifierBefore = isModificationChange(change) ? getParentIdentifier(change.data.before) : undefined
  return parentIdentifierBefore !== getParentIdentifier(change.data.after)
}

const hasInactiveParent = async (instance: InstanceElement): Promise<boolean> =>
  isReferenceExpression(instance.value[PARENT]) && isInstanceElement(instance.value[PARENT].value)
    ? instance.value[PARENT].value.value[INACTIVE_FIELDS.isInactive] === true
    : false

const changeValidator: NetsuiteChangeValidator = async changes =>
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(isDataElementChange)
    .filter(hasNewParent)
    .map(getChangeData)
    .filter(hasInactiveParent)
    .map(
      ({ elemID }): ChangeError => ({
        elemID,
        severity: 'Error',
        message: 'Inactive parent assigned',
        detailedMessage:
          "Can't deploy this element because its newly assigned parent is inactive." +
          ' To deploy it, activate its parent.',
      }),
    )
    .toArray()

export default changeValidator
