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
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isInstanceOfType } from '../filters/utils'

const { awu } = collections.asynciterable

const isRecordTypeInvalid = (instance: InstanceElement): boolean =>
  instance.value.recordTypeContext !== 'Master' &&
  instance.value.recordTypeContext !== 'All' &&
  instance.value.recordTypeId === undefined

const invalidRecordTypeError = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: 'Invalid AnimationRule RecordType',
  detailedMessage: `In ${instance.elemID.getFullName()}, The RecordTypeId field is missing even though RecordTypeContext requires a RecordTypeId.`,
})

const changeValidator = (): ChangeValidator => async (changes) =>
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(isInstanceOfType('AnimationRule'))
    .filter(isRecordTypeInvalid)
    .map(invalidRecordTypeError)
    .toArray()

export default changeValidator()
