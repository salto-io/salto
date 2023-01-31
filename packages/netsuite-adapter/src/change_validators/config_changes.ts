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
import {
  ElemID, getChangeData, InstanceElement, isInstanceChange, isModificationChange,
  ChangeError,
} from '@salto-io/adapter-api'
import { NetsuiteChangeValidator } from './types'


const getDifferenceFieldsElemIDs = (
  instance: InstanceElement,
  other: InstanceElement
): ElemID[] => {
  const instanceFieldNames = Object.keys(instance.value)
  const otherFieldNames = Object.keys(other.value)
  return _.difference(instanceFieldNames, otherFieldNames)
    .map(fieldName => instance.elemID.createNestedID(fieldName))
}

const changeValidator: NetsuiteChangeValidator = async changes => {
  const [modificationChanges, invalidChanges] = _.partition(
    changes
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.name === ElemID.CONFIG_NAME),
    isModificationChange
  )

  const instanceAdditionAndRemovalErrors: ChangeError[] = invalidChanges
    .map(getChangeData)
    .map(({ elemID }) => ({
      elemID,
      severity: 'Error',
      message: 'Addition or removal of a config instance is not supported',
      detailedMessage: 'Addition or removal of a config instance is not supported. This instance can only be modified.',
    }))

  const valuesRemovalErrors: ChangeError[] = modificationChanges
    .flatMap(change => getDifferenceFieldsElemIDs(change.data.before, change.data.after))
    .map(elemID => ({
      elemID,
      severity: 'Error',
      message: 'Removal of values in a config instance is not supported',
      detailedMessage: 'Removal of values in a config instance is not supported. Values can only be added or modified.',
    }))

  const valuesAdditionWarnings: ChangeError[] = modificationChanges
    .flatMap(change => getDifferenceFieldsElemIDs(change.data.after, change.data.before))
    .map(elemID => ({
      elemID,
      severity: 'Warning',
      message: 'Addition of values in a config instance may be ignored by NetSuite',
      detailedMessage: 'Addition of values in a config instance may be ignored by NetSuite. In this case they will be deleted in the next fetch.',
    }))

  return instanceAdditionAndRemovalErrors
    .concat(valuesRemovalErrors)
    .concat(valuesAdditionWarnings)
}

export default changeValidator
