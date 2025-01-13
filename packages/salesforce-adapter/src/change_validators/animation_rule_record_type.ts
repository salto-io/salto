/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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

const changeValidator = (): ChangeValidator => async changes =>
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(isInstanceOfType('AnimationRule'))
    .filter(isRecordTypeInvalid)
    .map(invalidRecordTypeError)
    .toArray()

export default changeValidator()
