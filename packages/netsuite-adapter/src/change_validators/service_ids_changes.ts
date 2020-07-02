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
  BuiltinTypes, ChangeError,
  ChangeValidator, getChangeElement, InstanceElement, isInstanceChange, isModificationDiff,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { isCustomType, isFileCabinetType } from '../types'

const changeValidator: ChangeValidator = async changes => (
  _.flatten(changes
    .filter(isModificationDiff)
    .filter(isInstanceChange)
    .filter(change => {
      const instance = getChangeElement(change) as InstanceElement
      return isCustomType(instance.type) || isFileCabinetType(instance.type)
    })
    .map(change => {
      const before = change.data.before as InstanceElement
      const after = change.data.after as InstanceElement
      const modifiedServiceIdsFields = Object.values(after.type.fields)
        .filter(field => field.type === BuiltinTypes.SERVICE_ID)
        .filter(field => before.value[field.name] !== after.value[field.name])
      return modifiedServiceIdsFields.map(modifiedServiceIdsField => ({
        elemID: after.elemID,
        severity: 'Error',
        message: 'Fields of type serviceId are immutable',
        detailedMessage: `Field (${modifiedServiceIdsField.name}) is immutable`,
      } as ChangeError))
    }))
)

export default changeValidator
