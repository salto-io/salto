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
import { collections } from '@salto-io/lowerdash'
import {
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isModificationChange,
  ChangeError,
  ModificationChange,
  isEqualValues,
  Value,
  Field,
  isListType,
} from '@salto-io/adapter-api'
import { isSuiteAppConfigInstance } from '../types'
import { SELECT_OPTION } from '../constants'
import { NetsuiteChangeValidator } from './types'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

const isSelectOptionTextChange = (beforeValue: Value, afterValue: Value, field?: Field): boolean =>
  field !== undefined && field.refType.elemID.typeName === SELECT_OPTION && afterValue.text !== beforeValue.text

const isMultiSelectOptionTextChange = async (
  beforeValue: Value,
  afterValue: Value,
  field?: Field,
): Promise<boolean> => {
  const fieldType = await field?.getType()
  if (!isListType(fieldType)) return false

  return (
    fieldType.refInnerType.elemID.typeName === SELECT_OPTION &&
    makeArray(afterValue).some((item, index) => item.text !== beforeValue[index]?.text)
  )
}
const getSelectOptionChangesElemIDs = async (change: ModificationChange<InstanceElement>): Promise<ElemID[]> => {
  const type = await change.data.after.getType()
  const beforeValues = change.data.before.value
  const afterValues = change.data.after.value
  return awu(Object.entries(afterValues))
    .filter(
      async ([fieldName, afterValue]) =>
        beforeValues[fieldName] !== undefined &&
        !isEqualValues(afterValue, beforeValues[fieldName]) &&
        (isSelectOptionTextChange(beforeValues[fieldName], afterValue, type.fields[fieldName]) ||
          // eslint-disable-next-line no-return-await
          (await isMultiSelectOptionTextChange(beforeValues[fieldName], afterValue, type.fields[fieldName]))),
    )
    .map(([fieldName]) => change.data.after.elemID.createNestedID(fieldName))
    .toArray()
}

const changeValidator: NetsuiteChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => isSuiteAppConfigInstance(getChangeData(change)))
    .flatMap(getSelectOptionChangesElemIDs)
    .map(
      (elemID): ChangeError => ({
        elemID,
        severity: 'Warning',
        message: 'Modification of this attribute in certain type fields is ignored by NetSuite',
        detailedMessage:
          'This modification is ignored by NetSuite. If you deploy it, the change will be deleted in Salto in the next fetch.\n' +
          'Consider doing this change directly in the NetSuite UI.',
      }),
    )
    .toArray()

export default changeValidator
