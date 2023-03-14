/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ChangeValidator, getChangeData, isInstanceChange, isAdditionChange, InstanceElement, ChangeError } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { APPLICATION_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

const getReadOnlyFields = (instance: InstanceElement): string[] => {
  const fields = []
  if (instance.value.licensing !== undefined) {
    fields.push('licensing')
  }
  const signing = _.get(instance.value, ['credentials', 'signing'])
  if (_.isPlainObject(signing)) {
    fields.push(...Object.keys(signing))
  }
  return fields
}

/**
 * Validate the created app does not have read only fields
 */
export const applicationFieldsValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
    .map((instance: InstanceElement): ChangeError | undefined => {
      // TODO SALTO-2690 can be removed after,
      // as these fields are defined as read-only fields by the swagger
      const readOnlyFields = getReadOnlyFields(instance)
      if (readOnlyFields.length > 0) {
        return {
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Cannot create an application with read only fields',
          detailedMessage: `Cannot create an application: ${instance.elemID.getFullName()} with read-only fields: ${readOnlyFields.join(',')}`,
        }
      }
      return undefined
    })
    .filter(values.isDefined)
    .toArray()
)
