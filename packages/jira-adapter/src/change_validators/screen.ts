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
  Values,
} from '@salto-io/adapter-api'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'

const { awu } = collections.asynciterable

export const screenValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === 'Screen')
    .map(async instance => {
      const usedFields = (Object.values(instance.value.tabs ?? {}) as Values[]).flatMap(tab => tab.fields ?? [])

      const duplicateFields = _(usedFields)
        .map(field => (isResolvedReferenceExpression(field) ? field.elemID.getFullName() : field))
        .countBy()
        .pickBy(count => count > 1)
        .keys()
        .value()

      if (duplicateFields.length > 0) {
        return {
          elemID: instance.elemID,
          severity: 'Error' as SeverityLevel,
          message: 'Can’t deploy screen which uses fields more than once',
          detailedMessage: `This screen uses the following ${duplicateFields.length > 1 ? 'fields' : 'field'} more than once: ${duplicateFields.join(', ')}. Make sure each field is used only once, and try again.`,
        }
      }
      return undefined
    })
    .filter(values.isDefined)
    .toArray()
