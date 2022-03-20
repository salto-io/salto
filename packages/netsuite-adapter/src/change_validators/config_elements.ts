/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import {
  ChangeValidator, ElemID, getChangeData, InstanceElement, isInstanceChange, isModificationChange,
  ChangeError,
  ModificationChange,
  isEqualValues,
  Value,
  Field,
  LIST_ID_PREFIX,
} from '@salto-io/adapter-api'
import { isConfigInstance } from '../types'
import { NETSUITE, SELECT_OPTION } from '../constants'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

const getDiffFieldsElemIDs = (
  fromInstance: InstanceElement,
  toInstance: InstanceElement
): ElemID[] => {
  const fromFieldNames = Object.keys(fromInstance.value)
  const toFieldNames = Object.keys(toInstance.value)
  return _.difference(fromFieldNames, toFieldNames)
    .map(fieldName => toInstance.elemID.createNestedID(fieldName))
}

const isSelectOptionTextChange = (
  beforeValue: Value,
  afterValue: Value,
  field?: Field
): boolean => field !== undefined
  && field.refType.elemID.typeName === SELECT_OPTION
  && afterValue.text !== beforeValue.text

const isMultiSelectOptionTextChange = (
  beforeValue: Value,
  afterValue: Value,
  field?: Field
): boolean => field !== undefined
  && field.refType.elemID.typeName === `${LIST_ID_PREFIX}<${NETSUITE}.${SELECT_OPTION}>`
  && makeArray(afterValue).some((item, index) => item.text !== beforeValue[index]?.text)

const getSelectOptionChangesElemIDs = async (
  change: ModificationChange<InstanceElement>
): Promise<ElemID[]> => {
  const type = await change.data.after.getType()
  const beforeValues = change.data.before.value
  const afterValues = change.data.after.value
  return Object.entries(afterValues)
    .filter(([fieldName, afterValue]) =>
      beforeValues[fieldName] !== undefined
        && !isEqualValues(afterValue, beforeValues[fieldName])
        && (
          isSelectOptionTextChange(
            beforeValues[fieldName], afterValue, type.fields[fieldName]
          ) || isMultiSelectOptionTextChange(
            beforeValues[fieldName], afterValue, type.fields[fieldName]
          )
        ))
    .map(([fieldName]) => change.data.after.elemID.createNestedID(fieldName))
}

const changeValidator: ChangeValidator = async changes => {
  const [modificationChanges, invalidChanges] = _.partition(
    changes
      .filter(isInstanceChange)
      .filter(change => isConfigInstance(getChangeData(change))),
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
    .flatMap(change => getDiffFieldsElemIDs(change.data.before, change.data.after))
    .map(elemID => ({
      elemID,
      severity: 'Error',
      message: 'Removal of values in a config instance is not supported',
      detailedMessage: 'Removal of values in a config instance is not supported. Values can only be added or modified.',
    }))

  const valuesAdditionWarnings: ChangeError[] = modificationChanges
    .flatMap(change => getDiffFieldsElemIDs(change.data.after, change.data.before))
    .map(elemID => ({
      elemID,
      severity: 'Warning',
      message: 'Addition of values in a config instance may be ignored by NetSuite',
      detailedMessage: 'Addition of values in a config instance may be ignored by NetSuite. In this case they will be deleted in the next fetch.',
    }))

  const selectOptionChangesWarnings = await awu(modificationChanges)
    .flatMap(getSelectOptionChangesElemIDs)
    .map((elemID): ChangeError => ({
      elemID,
      severity: 'Warning',
      message: 'Modification of the \'text\' attribute in \'select\' type fields are ignored on deploy',
      detailedMessage: 'Modification of the \'text\' attribute in \'select\' type fields are ignored on deploy. They will be restored in the next fetch.',
    })).toArray()

  return instanceAdditionAndRemovalErrors
    .concat(valuesRemovalErrors)
    .concat(valuesAdditionWarnings)
    .concat(selectOptionChangesWarnings)
}

export default changeValidator
