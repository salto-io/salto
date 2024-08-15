/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  ChangeError,
  Field,
  getChangeData,
  ChangeValidator,
  isModificationChange,
  ModificationChange,
  Change,
  isFieldChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isCustom, isFieldOfCustomObject } from '../transformers/transformer'
import { LABEL } from '../constants'

const { awu } = collections.asynciterable

const isStandardFieldChange = (change: Change<Field>): boolean => !isCustom(getChangeData(change).elemID.getFullName())

const isLabelModification = (change: ModificationChange<Field>): boolean => {
  const beforeAnnotations = change.data.before.annotations
  const afterAnnotations = change.data.after.annotations
  return beforeAnnotations[LABEL] !== afterAnnotations[LABEL]
}

const createChangeError = (field: Field): ChangeError => ({
  elemID: field.elemID,
  severity: 'Error',
  message: 'Modification of standard field labels is not supported',
  detailedMessage: `Standard field ‘${field.name}’ label cannot be modified`,
})

/**
 * It is forbidden to modify a label of a standard field.
 */
const changeValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isModificationChange)
    .filter(isFieldChange)
    .filter(change => isFieldOfCustomObject(getChangeData(change)))
    .filter(isStandardFieldChange)
    .filter(isLabelModification)
    .map(getChangeData)
    .map(createChangeError)
    .toArray()

export default changeValidator
