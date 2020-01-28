import _ from 'lodash'
import {
  Change, Field, getChangeElement, isField,
  isModificationDiff, ChangeError, ChangeDataType, CORE_ANNOTATIONS,
} from 'adapter-api'
import { FIELD_LEVEL_SECURITY_ANNOTATION } from '../constants'

export const changeValidator = {
  onUpdate: async (changes: ReadonlyArray<Change>): Promise<ReadonlyArray<ChangeError>> => {
    const isRequiredFieldWithPermissions = (element: ChangeDataType): boolean => {
      if (!isField(element)) {
        return false
      }
      return element.annotations[CORE_ANNOTATIONS.REQUIRED]
        && !_.isEmpty(element.annotations[FIELD_LEVEL_SECURITY_ANNOTATION])
    }

    return changes
      .filter(isModificationDiff)
      .filter(change => isRequiredFieldWithPermissions(change.data.after))
      .map(change => ({
        elemID: getChangeElement(change).elemID,
        severity: 'Error',
        message: `You cannot deploy required field with field permissions. Field: ${(change.data.after as Field).name}`,
        detailedMessage: 'You cannot deploy required field with field permissions',
      }))
  },
}

export default changeValidator
