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
import { values } from '@salto-io/lowerdash'
import {
  Change,
  ChangeError,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isModificationChange,
  SeverityLevel,
  Value,
} from '@salto-io/adapter-api'
import { isStandardType } from '../types'
import { NetsuiteChangeValidator } from './types'


const { isDefined } = values

type InvalidValue = {
  typeName: string
  path: string[]
  value: Value
  error: {
    severity: SeverityLevel
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
      detailedMessage: 'role.subsidiaryoption cannot be deployed with value "SELECTED", please set a different value and manually edit it via the NetSuite UI',
    },
  },
]

const getInvalidValuesChangeErrors = (
  { typeName, path, value, error }: InvalidValue,
  instanceChanges: Record<string, Change<InstanceElement>[]>
): ChangeError[] => {
  if (!(typeName in instanceChanges)) {
    return []
  }

  return instanceChanges[typeName].map(change => {
    const instance = getChangeData(change)
    if (_.get(instance.value, path) !== value
      || (isModificationChange(change) && _.get(change.data.before.value, path) === value)) {
      return undefined
    }

    const elemID = instance.elemID.createNestedID(...path)
    return {
      ...error,
      elemID,
      message: `Invalid value in ${elemID.getFullName()}`,
    }
  }).filter(isDefined)
}

const changeValidator: NetsuiteChangeValidator = async changes => {
  const instanceChanges = _.groupBy(
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .filter(change => isStandardType(getChangeData(change).refType)),
    change => getChangeData(change).elemID.typeName
  )

  return invalidValues.flatMap(
    invalidValue => getInvalidValuesChangeErrors(invalidValue, instanceChanges)
  )
}

export default changeValidator
