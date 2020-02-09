/*
*                      Copyright 2020 Salto Labs Ltd.
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
    detailedMessage: 'You cannot deploy a required field with field level security annotation',
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
      .map(change => createPermissionChangeError(
        getChangeElement(change).elemID,
        (getChangeElement(change) as Field).name
      )),
}

export default changeValidator
