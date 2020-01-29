import _ from 'lodash'
import {
  Change, Field, getChangeElement, isField, isObjectType, ElemID, Element,
  isModificationDiff, ChangeError, ChangeDataType, CORE_ANNOTATIONS, isAdditionDiff,
} from 'adapter-api'
import { FIELD_LEVEL_SECURITY_ANNOTATION } from '../constants'

const isRequiredFieldWithPermissions = (element: ChangeDataType): boolean =>
  element.annotations[CORE_ANNOTATIONS.REQUIRED]
    && !_.isEmpty(element.annotations[FIELD_LEVEL_SECURITY_ANNOTATION])

const createPermissionChangeError = (elemID: ElemID, fieldName: string): ChangeError =>
  ({
    elemID,
    severity: 'Error',
    message: `You cannot deploy required field with field permissions. Field: ${fieldName}`,
    detailedMessage: 'You cannot deploy required field with field permissions',
  })

export const changeValidator = {
  onAdd: async (after: Element): Promise<ReadonlyArray<ChangeError>> => {
    if (isObjectType(after)) {
      return Object.values(after.fields)
        .filter(isRequiredFieldWithPermissions)
        .map(f => createPermissionChangeError(f.elemID, f.name))
    }
    return []
  },

  onUpdate: async (changes: ReadonlyArray<Change>): Promise<ReadonlyArray<ChangeError>> =>
    changes
      .filter(change => isModificationDiff(change) || isAdditionDiff(change))
      .filter(change => isField(getChangeElement(change)))
      .filter(change => isRequiredFieldWithPermissions(getChangeElement(change)))
      .map(change => ({
        elemID: getChangeElement(change).elemID,
        severity: 'Error',
        message: `You cannot deploy required field with field permissions. Field: ${(getChangeElement(change) as Field).name}`,
        detailedMessage: 'You cannot deploy required field with field permissions',
      })),
}

export default changeValidator
