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
  ChangeError, ChangeValidator, CORE_ANNOTATIONS, InstanceElement,
  isInstanceChange, isModificationChange, isReferenceExpression, isServiceId,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { TYPE_TO_ID_FIELD_PATHS } from '../data_elements/multi_fields_identifiers'
import { isDataObjectType, isFileCabinetType } from '../types'

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
    .flatMap(async change => {
      const before = change.data.before as InstanceElement
      const after = change.data.after as InstanceElement
      const modifiedImmutableFields = await awu(Object.values((await after.getType()).fields))
        .filter(async field => isServiceId(await field.getType()))
        .filter(field => before.value[field.name] !== after.value[field.name])
        .map(field => field.elemID.getFullName())
        .toArray()

      if (isDataObjectType(await after.getType())
        && after.elemID.typeName in TYPE_TO_ID_FIELD_PATHS) {
        modifiedImmutableFields.push(
          ...TYPE_TO_ID_FIELD_PATHS[after.elemID.typeName]
            .filter(path => _.get(before.value, path) !== _.get(after.value, path))
            .map(path => after.elemID.createNestedID(...path).getFullName())
        )
      }

      // parent annotations in file cabinet instances
      if (isFileCabinetType(after.refType.elemID)
        && !_.isEqual(
          getParents(before).map(getReferenceIdentifier),
          getParents(after).map(getReferenceIdentifier),
        )) {
        modifiedImmutableFields.push(
          after.elemID.createNestedID(CORE_ANNOTATIONS.PARENT).getFullName()
        )
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
