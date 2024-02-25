/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  ChangeValidator,
  isModificationChange,
  isInstanceChange,
  getChangeData,
  InstanceElement,
  ChangeError,
} from '@salto-io/adapter-api'
import { values, types } from '@salto-io/lowerdash'
import {
  apiNameSync,
  isHiddenField,
  isQueryableField,
  isReadOnlyField,
} from '../filters/utils'

const { isDefined } = values
const { isNonEmptyArray } = types

const getVisibleNonQueryableFieldsOfInstanceType = (
  instance: InstanceElement,
): string[] =>
  Object.values(instance.getTypeSync().fields)
    .filter(
      (field) =>
        !isQueryableField(field) &&
        !isReadOnlyField(field) &&
        !isHiddenField(field),
    )
    .map((field) => apiNameSync(field))
    .filter(isDefined)

const createNonQueryableFieldsWarning = ({
  instance,
  fields,
}: {
  instance: InstanceElement
  fields: string[]
}): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Warning',
  message: `The type of this instance (${apiNameSync(instance.getTypeSync())}) has inaccessible fields. Deploying the instance may be interpreted as deleting these fields.`,
  detailedMessage: `The following fields were not readable/queryable by the user who last fetched this workspace. As a result, these fields are seen as empty, and when they are deployed their values will be erased in the target environment: ${fields.join(',')}`,
})

/**
 * When we fetch a type that has some fields that are not queryable by the fetching user, any instances of this type
 * will be fetched without values for said fields. If we later try to deploy these instances, these missing values are
 * interpreted as if we want to delete the values of these fields. This is probably not what the user wants.
 * */
const changeValidator: ChangeValidator = async (changes) =>
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .map(getChangeData)
    .map((instance) => ({
      instance,
      fields: getVisibleNonQueryableFieldsOfInstanceType(instance),
    }))
    .filter(({ fields }) => isNonEmptyArray(fields))
    .map(createNonQueryableFieldsWarning)

export default changeValidator
