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
import {
  ChangeError, ChangeValidator, CORE_ANNOTATIONS, getChangeElement, InstanceElement,
  isInstanceChange, isModificationChange, isReferenceExpression,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { isCustomType, isFileCabinetType } from '../types'

const { awu } = collections.asynciterable

// In netsuite, a reference can be either a ReferenceExpression
// or a string of the form [/some/path] or [scriptid=someid] if no reference was found.
// In the case of ReferenceExpression, we would want to compare using the elemID,
// otherwise we can use the string.
const getReferenceIdentifier = (val: unknown): unknown =>
  (isReferenceExpression(val) ? val.elemID.getFullName() : val)


const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(change => {
      const instance = getChangeElement(change) as InstanceElement
      return isCustomType(instance.refType.elemID) || isFileCabinetType(instance.refType.elemID)
    })
    .flatMap(async change => {
      const before = change.data.before as InstanceElement
      const after = change.data.after as InstanceElement
      const modifiedImmutableFields = await awu(Object.values((await after.getType()).fields))
        .filter(async field => (await field.getType())
          .annotations?.[CORE_ANNOTATIONS.SERVICE_ID] === true)
        .filter(field => before.value[field.name] !== after.value[field.name])
        .map(field => field.name)
        .toArray()

      // parent annotations in file cabinet instances
      if (isFileCabinetType(after.refType.elemID)
        && !_.isEqual(
          getParents(before).map(getReferenceIdentifier),
          getParents(after).map(getReferenceIdentifier),
        )) {
        modifiedImmutableFields.push(CORE_ANNOTATIONS.PARENT)
      }
      return modifiedImmutableFields.map(modifiedField => ({
        elemID: after.elemID,
        severity: 'Error',
        message: 'Attempting to modify an immutable field',
        detailedMessage: `Field (${modifiedField}) is immutable`,
      } as ChangeError))
    })
    .toArray()
)

export default changeValidator
