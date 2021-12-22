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
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import {
  ChangeValidator,
  getChangeElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isModificationChange,
  SaltoErrorSeverity,
  Value,
} from '@salto-io/adapter-api'
import { isCustomType } from '../types'

const { isDefined } = values

type InvalidValue = {
  typeName: string
  path: string[]
  value: Value
  error: {
    severity: SaltoErrorSeverity
    detailedMessage: string
  }
}

const invalidValues: InvalidValue[] = [
  {
    typeName: 'role',
    path: ['subsidiaryoption'],
    value: 'SELECTED',
    error: {
      severity: 'Error',
      detailedMessage: 'role.subsidiaryoption cannot be deployed with value "SELECTED", please deploy it with another value and edit in NetSuite UI',
    },
  },
]

const changeValidator: ChangeValidator = async changes => {
  const instanceChanges = _.groupBy(
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .filter(change => isCustomType(getChangeElement(change).refType.elemID)),
    change => getChangeElement(change).elemID.typeName
  )

  return invalidValues.flatMap(({ typeName, path, value, error }) => {
    if (!(typeName in instanceChanges)) {
      return []
    }

    return instanceChanges[typeName].map(change => {
      const instance = getChangeElement(change)
      if (_.get(instance.value, path) !== value
        || (isModificationChange(change) && _.get(change.data.before.value, path) === value)) {
        return undefined
      }

      return {
        ...error,
        elemID: instance.elemID,
        message: `Invalid value in ${typeName}.${path.join('.')}`,
      }
    }).filter(isDefined)
  })
}

export default changeValidator
