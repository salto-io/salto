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
  ChangeError, Change, getChangeElement, isInstanceElement, Element,
  isModificationDiff, InstanceElement, Value, isReferenceExpression,
} from '@salto-io/adapter-api'
import { makeArray } from '@salto-io/lowerdash/dist/src/collections/array'
import { isFormInstance } from '../filters/form_field'
import {
  OBJECTS_NAMES,
} from '../constants'


const getFormInstanceFieldErrorsFromAfter = async (after: InstanceElement):
  Promise<ReadonlyArray<ChangeError>> => {
  const getErrorsFromField = (field: Value): ReadonlyArray<ChangeError> => {
    const errors = [] as ChangeError[]
    if (!isReferenceExpression(field.contactProperty)
      || (field.contactProperty.elemId.typeName !== OBJECTS_NAMES.CONTACT_PROPERTY)) {
      errors.push({
        elemID: after.elemID,
        severity: 'Error',
        message: `${field.contactProperty} is not a valid for contactProperty`,
        detailedMessage: 'contactProperty field must be a reference of ContactProperty instance',
      } as ChangeError)
    }
    let dependentErrors = [] as ChangeError[]
    if (field.dependentFieldFilters) {
      dependentErrors = _.flatten(field.dependentFieldFilters.map(
        (dependentFieldFilter: { dependentFormField: Value }) => {
          const { dependentFormField } = dependentFieldFilter
          // This does not create recursion loop because dependentFields don't have dependent fields
          return getErrorsFromField(dependentFormField)
        }
      ))
    }
    return errors.concat(dependentErrors)
  }

  if (!isFormInstance(after)) {
    return []
  }

  const { formFieldGroups } = after.value
  return _.flatten(makeArray(formFieldGroups).map((formFieldGroup: Value) => {
    const { fields } = formFieldGroup
    return _.flatten(makeArray(fields).map((field: Value) => getErrorsFromField(field)))
  })) as ChangeError[]
}

export const changeValidator = {
  onAdd: async (after: Element): Promise<ReadonlyArray<ChangeError>> => {
    if (!isInstanceElement(after)) {
      return []
    }
    return getFormInstanceFieldErrorsFromAfter(after)
  },
  onUpdate: async (changes: ReadonlyArray<Change>): Promise<ReadonlyArray<ChangeError>> => {
    const getChangeError = async (change: Change): Promise<ReadonlyArray<ChangeError>> => {
      const changeElement = getChangeElement(change)
      if (isInstanceElement(changeElement) && isModificationDiff(change)) {
        return getFormInstanceFieldErrorsFromAfter(change.data.after as InstanceElement)
      }
      return []
    }
    return _.flatten(await Promise.all(changes.map(change => getChangeError(change))))
  },
}

export default changeValidator
