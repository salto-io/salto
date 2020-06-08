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
import { ChangeError, BuiltinTypes, InstanceElement, isPrimitiveType, isInstanceChange, ChangeValidator, isAdditionOrModificationDiff } from '@salto-io/adapter-api'
import { resolveValues } from '@salto-io/adapter-utils'
import { getLookUpName } from '../transformers/transformer'

const getJsonValidationErrorsFromAfter = async (after: InstanceElement):
  Promise<ReadonlyArray<ChangeError>> => {
  const resolvedAfter = resolveValues(after, getLookUpName)
  const errors = Object.values(_.pickBy(_.mapValues(resolvedAfter.value, (val, key) => {
    const field = after.type.fields[key]
    const fieldType = field?.type
    if (isPrimitiveType(fieldType) && fieldType.isEqual(BuiltinTypes.JSON)) {
      try {
        JSON.parse(val)
      } catch (error) {
        return {
          elemID: after.elemID,
          severity: 'Error',
          message: `Error parsing the json string in field ${after.elemID.name}.${field.name}`,
          detailedMessage: `Error (${error.message}) parsing the json string in field ${after.elemID.name}.${field.name}`,
        }
      }
    }
    return undefined
  }), v => !_.isUndefined(v))) as ChangeError[]
  return errors
}

const changeValidator: ChangeValidator = async changes => (
  _.flatten(await Promise.all(
    changes.changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationDiff)
      .map(change => getJsonValidationErrorsFromAfter(change.data.after))
  ))
)

export default changeValidator
