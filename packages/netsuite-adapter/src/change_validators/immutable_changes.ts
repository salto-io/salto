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
  BuiltinTypes, ChangeError, ChangeValidator, CORE_ANNOTATIONS, getChangeElement, InstanceElement,
  isInstanceChange, isModificationChange, isReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { isCustomType, isFileCabinetType } from '../types'

const getReferenceValue = (val: unknown): unknown => (isReferenceExpression(val) ? val.value : val)

const changeValidator: ChangeValidator = async changes => (
  _.flatten(changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(change => {
      const instance = getChangeElement(change) as InstanceElement
      return isCustomType(instance.type) || isFileCabinetType(instance.type)
    })
    .map(change => {
      const before = change.data.before as InstanceElement
      const after = change.data.after as InstanceElement

      // service ids fields
      const modifiedImmutableFields = Object.values(after.type.fields)
        .filter(field => field.type === BuiltinTypes.SERVICE_ID)
        .filter(field => before.value[field.name] !== after.value[field.name])
        .map(field => field.name)

      // parent annotations in file cabinet instances
      if (isFileCabinetType(after.type)
        && getReferenceValue(before.annotations[CORE_ANNOTATIONS.PARENT])
          !== getReferenceValue(after.annotations[CORE_ANNOTATIONS.PARENT])) {
        modifiedImmutableFields.push(CORE_ANNOTATIONS.PARENT)
      }
      return modifiedImmutableFields.map(modifiedField => ({
        elemID: after.elemID,
        severity: 'Error',
        message: 'Attempting to modify an immutable field',
        detailedMessage: `Field (${modifiedField}) is immutable`,
      } as ChangeError))
    }))
)

export default changeValidator
