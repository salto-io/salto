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
  ChangeError,
  ChangeValidator,
  InstanceElement,
  ReadOnlyElementsSource,
  getChangeData,
  isAdditionChange,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { ROLE_ASSIGNMENT_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const log = logger(module)

const isNonSecurityGroup = async (
  instance: InstanceElement,
  elementSource: ReadOnlyElementsSource,
): Promise<boolean> => {
  const groupReference = instance.value.assignedTo
  if (isReferenceExpression(groupReference)) {
    try {
      const group = await groupReference.getResolvedValue(elementSource)
      return !Object.prototype.hasOwnProperty.call(
        group.value.labels,
        'cloudidentity_googleapis_com_groups_security@vvdv',
      )
    } catch (e) {
      log.error('Failed to resolve group reference %s for role assignment', groupReference.elemID.getFullName())
      return false
    }
  }
  return false
}

// This validator checks that role assignments are only created for security groups.
export const roleAssignmentAdditionValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    return []
  }
  return awu(changes)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === ROLE_ASSIGNMENT_TYPE_NAME)
    .filter(async instance => isNonSecurityGroup(instance, elementSource))
    .map(
      ({ elemID }): ChangeError => ({
        elemID,
        severity: 'Error',
        message: 'Can not create role assignment for non security groups',
        detailedMessage: 'Can not create role assignment for non security groups',
      }),
    )
    .toArray()
}
