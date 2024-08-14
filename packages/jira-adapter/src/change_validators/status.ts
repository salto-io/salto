/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  SeverityLevel,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { STATUS_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const NO_CATEGORY_STATUS = 'No Category'

export const statusValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === STATUS_TYPE_NAME)
    .filter(
      instance =>
        isResolvedReferenceExpression(instance.value.statusCategory) &&
        isInstanceElement(instance.value.statusCategory.value) &&
        instance.value.statusCategory.value.value.name === NO_CATEGORY_STATUS,
    )
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'statusCategory can not have No_Category value',
      detailedMessage: `This status has an invalid statusCategory ${instance.value.statusCategory.elemID.name}. statusCategory should be one of the following: Done, In_Progress or To_Do.`,
    }))
    .toArray()
