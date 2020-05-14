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
import { ChangeError, Change, isInstanceElement, Element,
  BuiltinTypes, getChangeElement, isModificationDiff, InstanceElement, isPrimitiveType, isStaticFile } from '@salto-io/adapter-api'

const getJsonValidationErrorsFromAfter = async (after: Element):
  Promise<ReadonlyArray<ChangeError>> => {
  if (!isInstanceElement(after)) {
    return []
  }
  const errors = Object.values(_.pickBy(_.mapValues(after.value, (val, key) => {
    const field = after.type.fields[key]
    const fieldType = field?.type
    if (isPrimitiveType(fieldType) && fieldType.isEqual(BuiltinTypes.JSON)) {
      const jsonValue = isStaticFile(val) ? val.content?.toString() : val
      try {
        JSON.parse(jsonValue)
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

export const changeValidator = {
  onAdd: async (after: Element): Promise<ReadonlyArray<ChangeError>> =>
    getJsonValidationErrorsFromAfter(after),
  onUpdate: async (changes: ReadonlyArray<Change>): Promise<ReadonlyArray<ChangeError>> => {
    const getChangeError = async (change: Change): Promise<ReadonlyArray<ChangeError>> => {
      const changeElement = getChangeElement(change)
      if (isInstanceElement(changeElement) && isModificationDiff(change)) {
        return getJsonValidationErrorsFromAfter(change.data.after as InstanceElement)
      }
      return []
    }
    return _.flatten(await Promise.all(changes.map(change => getChangeError(change))))
  },
}

export default changeValidator
