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
import {
  ChangeError, Field, getChangeElement,
  ChangeValidator, isModificationChange, ModificationChange, Change, isFieldChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isCustom, isFieldOfCustomObject } from '../transformers/transformer'
import { LABEL } from '../constants'

const { awu } = collections.asynciterable


const isStandardFieldChange = (change: Change<Field>): boolean =>
  (!isCustom(getChangeElement(change).elemID.getFullName()))


const isLabelModification = (change: ModificationChange<Field>): boolean => {
  const beforeAnnotations = change.data.before.annotations
  const afterAnnotations = change.data.after.annotations
  return beforeAnnotations[LABEL] !== afterAnnotations[LABEL]
}


const createChangeError = (field: Field): ChangeError => ({
  elemID: field.elemID,
  severity: 'Error',
  message: `You cannot modify labels of standard fields. This change will NOT be deployed. Field: ${field.name}`,
  detailedMessage: `You cannot modify labels of standard fields. This change will NOT be deployed. Field: ${field.name}`,
})

/**
 * It is forbidden to modify a label of a standard field.
 */
const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isModificationChange)
    .filter(isFieldChange)
    .filter(change => isFieldOfCustomObject(getChangeElement(change)))
    .filter(isStandardFieldChange)
    .filter(isLabelModification)
    .map(getChangeElement)
    .map(createChangeError)
    .toArray()
)

export default changeValidator
