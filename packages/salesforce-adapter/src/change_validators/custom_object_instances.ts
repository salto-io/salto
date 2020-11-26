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
import {
  ChangeValidator, getChangeElement, isModificationChange,
  InstanceElement, ChangeError, isAdditionChange,
} from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import { resolveValues } from '@salto-io/adapter-utils'

import { FIELD_ANNOTATIONS } from '../constants'
import { getLookUpName } from '../transformers/reference_mapping'
import { isInstanceOfCustomObjectChange } from '../custom_object_instances_deploy'

const { awu } = collections.asynciterable

const getUpdateErrorsForNonUpdateableFields = async (
  before: InstanceElement,
  after: InstanceElement
): Promise<ReadonlyArray<ChangeError>> => {
  const beforeResoleved = await resolveValues(before, getLookUpName)
  const afterResolved = await resolveValues(after, getLookUpName)
  return Object.values((await afterResolved.getType()).fields)
    .filter(field => !field.annotations[FIELD_ANNOTATIONS.UPDATEABLE])
    .map(field => {
      if (afterResolved.value[field.name] !== beforeResoleved.value[field.name]) {
        return {
          elemID: beforeResoleved.elemID,
          severity: 'Warning',
          message: `Unable to edit ${afterResolved.elemID.typeName}.${field.name} because it is a non-updateable field.`,
          detailedMessage: `Unable to edit ${field.name} inside ${beforeResoleved.elemID.getFullName()} because it is a non-updateable field.`,
        } as ChangeError
      }
      return undefined
    }).filter(values.isDefined)
}

const getCreateErrorsForNonCreatableFields = async (
  after: InstanceElement
): Promise<ReadonlyArray<ChangeError>> => {
  const afterResolved = await resolveValues(after, getLookUpName)
  return awu(Object.values((await afterResolved.getType()).fields))
    .filter(field => !field.annotations[FIELD_ANNOTATIONS.CREATABLE])
    .map(field => {
      if (!_.isUndefined(afterResolved.value[field.name])) {
        return {
          elemID: afterResolved.elemID,
          severity: 'Warning',
          message: `Unable to create ${afterResolved.elemID.typeName}.${field.name} because it is a non-creatable field.`,
          detailedMessage: `Unable to create ${field.name} inside ${afterResolved.elemID.getFullName()} because it is a non-creatable field.`,
        } as ChangeError
      }
      return undefined
    }).filter(values.isDefined)
    .toArray()
}


const changeValidator: ChangeValidator = async changes => {
  const updateChangeErrors = await awu(changes)
    .filter(isInstanceOfCustomObjectChange)
    .filter(isModificationChange)
    .flatMap(change =>
      getUpdateErrorsForNonUpdateableFields(
        change.data.before as InstanceElement,
        change.data.after as InstanceElement
      ))
    .toArray()

  const createChangeErrors = await awu(changes)
    .filter(isInstanceOfCustomObjectChange)
    .filter(isAdditionChange)
    .flatMap(change => getCreateErrorsForNonCreatableFields(
      getChangeElement(change) as InstanceElement
    ))
    .toArray()

  return [
    ...updateChangeErrors,
    ...createChangeErrors,
  ]
}

export default changeValidator
