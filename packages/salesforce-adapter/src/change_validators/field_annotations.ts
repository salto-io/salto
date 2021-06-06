/*
*                      Copyright 2021 Salto Labs Ltd.
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
  ChangeError, Field, getChangeElement,
  ChangeValidator, isModificationChange, ModificationChange, isFieldChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isFieldOfCustomObject } from '../transformers/transformer'
import { FIELD_ANNOTATIONS } from '../constants'

const { awu } = collections.asynciterable

const READONLY_ANNOTATIONS = [
  FIELD_ANNOTATIONS.CREATABLE,
  FIELD_ANNOTATIONS.UPDATEABLE,
  FIELD_ANNOTATIONS.QUERYABLE,
]

const isReadOnlyAnnotationHasChanged = (change: ModificationChange<Field>): boolean => {
  const readOnlyAnnotationBefore = READONLY_ANNOTATIONS
    .map(key => change.data.before.annotations[key])
  const readOnlyAnnotationAfter = READONLY_ANNOTATIONS
    .map(key => change.data.after.annotations[key])
  return readOnlyAnnotationBefore.length !== readOnlyAnnotationAfter.length
      || !readOnlyAnnotationBefore
        .every((element, index): boolean => element === readOnlyAnnotationAfter[index])
}

const createChangeError = (field: Field): ChangeError => ({
  elemID: field.elemID,
  severity: 'Warning',
  message: `You cannot modify READ ONLY annotations such as {${READONLY_ANNOTATIONS}} changes made to these annotations will NOT be deployed`,
  detailedMessage: `You cannot modify READ ONLY annotations such as {${READONLY_ANNOTATIONS}} changes made to these annotations will NOT be deployed`,
})

/**
* It is forbidden to modify READ ONLY annotations.
*/
const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isModificationChange)
    .filter(isFieldChange)
    .filter(change => isFieldOfCustomObject(getChangeElement(change)))
    .filter(isReadOnlyAnnotationHasChanged)
    .map(getChangeElement)
    .map(createChangeError)
    .toArray()
)

export default changeValidator
