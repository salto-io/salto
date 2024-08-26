/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  isModificationChange,
  isInstanceChange,
  getChangeData,
  InstanceElement,
  ChangeError,
} from '@salto-io/adapter-api'
import { values, types } from '@salto-io/lowerdash'
import { apiNameSync, isHiddenField, isQueryableField, isReadOnlyField } from '../filters/utils'

const { isDefined } = values
const { isNonEmptyArray } = types

const getVisibleNonQueryableFieldsOfInstanceType = (instance: InstanceElement): string[] =>
  Object.values(instance.getTypeSync().fields)
    .filter(field => !isQueryableField(field) && !isReadOnlyField(field) && !isHiddenField(field))
    .map(field => apiNameSync(field))
    .filter(isDefined)

const createNonQueryableFieldsWarning = ({
  instance,
  fields,
}: {
  instance: InstanceElement
  fields: string[]
}): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Warning',
  message: 'Inaccessible fields may lead to field deletion.',
  detailedMessage: `Some fields were not readable or queryable by the user who last fetched this workspace. As a result, these fields appear to have no value. Deploying these fields will cause their value in the service to be erased. The affected fields are: ${fields.join(',')}`,
})

/**
 * When we fetch a type that has some fields that are not queryable by the fetching user, any instances of this type
 * will be fetched without values for said fields. If we later try to deploy these instances, these missing values are
 * interpreted as if we want to delete the values of these fields. This is probably not what the user wants.
 * */
const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .map(getChangeData)
    .map(instance => ({
      instance,
      fields: getVisibleNonQueryableFieldsOfInstanceType(instance),
    }))
    .filter(({ fields }) => isNonEmptyArray(fields))
    .map(createNonQueryableFieldsWarning)

export default changeValidator
