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
import { ChangeError, isModificationDiff, InstanceElement, ChangeValidator, isInstanceChange } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { resolveValues } from '@salto-io/adapter-utils'
import { getLookUpName } from '../transformers/transformer'
import { OBJECTS_NAMES, FORM_FIELDS, MARKETING_EMAIL_FIELDS, CONTACT_PROPERTY_FIELDS } from '../constants'

const readOnlyTypeToFields = {
  [OBJECTS_NAMES.FORM]: [FORM_FIELDS.DELETABLE, FORM_FIELDS.CLONEABLE, FORM_FIELDS.EDITABLE],
  [OBJECTS_NAMES.MARKETINGEMAIL]: [MARKETING_EMAIL_FIELDS.ISPUBLISHED,
    MARKETING_EMAIL_FIELDS.PUBLISHEDURL, MARKETING_EMAIL_FIELDS.RESOLVEDDOMAIN],
  [OBJECTS_NAMES.CONTACT_PROPERTY]: [CONTACT_PROPERTY_FIELDS.NAME, CONTACT_PROPERTY_FIELDS.DELETED],
}

/*
* Check that all values of ready-only fields are the same in before and after.
* This implementation only supports top level primitive types.
*/
const getReadonlyValidationError = async (before: InstanceElement, after: InstanceElement):
  Promise<ReadonlyArray<ChangeError>> => {
  const readonlyFieldNames = readOnlyTypeToFields[after.type.elemID.name]
  if (_.isUndefined(readonlyFieldNames)) {
    return []
  }
  const afterResolved = resolveValues(after, getLookUpName)
  const beforeResolved = resolveValues(before, getLookUpName)
  return Object.values(after.type.fields)
    .filter(field => readonlyFieldNames.includes(field.name))
    .map(field => {
      if (afterResolved.value[field.name] !== beforeResolved.value[field.name]) {
        return {
          elemID: before.elemID,
          severity: 'Error',
          message: `Unable to edit ${after.elemID.typeName}.${field.name} because it is a read-only field.`,
          detailedMessage: `Unable to edit ${field.name} inside ${before.elemID.getFullName()} because it is a read-only field.`,
        } as ChangeError
      }
      return undefined
    }).filter(values.isDefined)
}

const changeValidator: ChangeValidator = async changes => (
  _.flatten(await Promise.all(
    changes.changes
      .filter(isInstanceChange)
      .filter(isModificationDiff)
      .map(change => getReadonlyValidationError(change.data.before, change.data.after))
  ))
)

export default changeValidator
