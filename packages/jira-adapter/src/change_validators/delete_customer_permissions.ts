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
import { ChangeValidator, getChangeData, isInstanceChange, SeverityLevel, isRemovalChange, Change } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { getParent } from '@salto-io/adapter-utils'
import { CUSTOMER_PERMISSIONS_TYPE, PROJECT_TYPE } from '../constants'

const { awu } = collections.asynciterable

export const isRemovingProject = (changes: readonly Change[], projectFullName: string):
boolean => changes.some(change =>
  isInstanceChange(change)
    && isRemovalChange(change)
    && getChangeData(change).elemID.typeName === PROJECT_TYPE
    && getChangeData(change).elemID.getFullName() === projectFullName)

export const deleteCustomerPermissionValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    return []
  }
  const relevantChanges = changes.filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === CUSTOMER_PERMISSIONS_TYPE)
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(inst => {
      const project = getParent(inst)
      return !isRemovingProject(changes, project.elemID.getFullName())
    })

  return awu(relevantChanges)
    .map(inst => ({
      elemID: inst.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Cannot delete Customer Permissions while their associated project is still in use.',
      detailedMessage: `Cannot delete Customer Permissions ${inst.elemID.name} because their associated project ${getParent(inst).elemID.name} is still in use.`,
    }))
    .toArray()
}
