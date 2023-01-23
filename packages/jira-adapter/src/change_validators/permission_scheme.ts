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
import { AdditionChange, Change, ChangeDataType, ChangeError, ChangeValidator, ElemID, getChangeData, InstanceElement, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, isModificationChange, isRemovalChange, ModificationChange, SeverityLevel } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { isFreeLicense } from '../utils'
import JiraClient from '../client/client'
import { PERMISSION_SCHEME_TYPE_NAME, PROJECT_TYPE } from '../constants'

const { awu } = collections.asynciterable
const log = logger(module)

const projectError = (elemID: ElemID): ChangeError => ({
  elemID,
  severity: 'Error' as SeverityLevel,
  message: 'Can’t modify association between a project and a permission scheme',
  detailedMessage: 'This free Jira instance doesn’t support modifying associations between projects and permission schemes.',
})

const projectWarning = (elemID: ElemID, schemeName: string): ChangeError => ({
  elemID,
  severity: 'Warning' as SeverityLevel,
  message: 'Project will be deployed with a default permission scheme instead',
  detailedMessage: `This project uses the ${schemeName} permission scheme. However, the target Jira instance is a free one, which doesn’t support creating permission schemes. After deployment, the project will use a newly created default scheme.`,
})

const schemeError = (elemID: ElemID): ChangeError => ({
  elemID,
  severity: 'Error' as SeverityLevel,
  message: 'Can’t deploy permission schemes to a free Jira instance',
  detailedMessage: 'The target Jira instance is a free one, which doesn’t support permission schemes. This permission scheme won’t be deployed.',
})

const schemeWarning = (elemID: ElemID): ChangeError => ({
  elemID,
  severity: 'Warning' as SeverityLevel,
  message: 'Can’t deploy permission schemes to a free Jira instance',
  detailedMessage: 'The target Jira instance is a free one, which doesn’t support permission schemes. This permission scheme won’t be deployed.',
})

const wasSchemeAssociatedToAnyProjectBefore = (
  schemeChange: Change<InstanceElement>,
  changes: readonly Change<ChangeDataType>[]
): boolean => changes
  .filter(isInstanceChange)
  .filter(change => getChangeData(change).elemID.typeName === PROJECT_TYPE)
  .filter(isModificationChange)
  .some(change => change.data.before.value.permissionScheme?.elemID.getFullName()
    === getChangeData(schemeChange).elemID.getFullName()
      && change.data.after.value.permissionScheme?.elemID.getFullName()
      !== getChangeData(schemeChange).elemID.getFullName())


const isPermissionSchemeAssociationChange = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>
): boolean => {
  const elemBefore = isModificationChange(change)
    ? change.data.before.value.permissionScheme?.elemID?.getFullName()
    : undefined
  const elemAfter = change.data.after.value.permissionScheme?.elemID?.getFullName()
  return (elemBefore !== elemAfter)
}

const isSameChangeForProject = (
  schemeChange: Change<InstanceElement>,
  changes: readonly Change<ChangeDataType>[]
): boolean => changes
  .filter(isInstanceChange)
  .filter(change => change.action === schemeChange.action)
  .map(getChangeData)
  .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
  .some(instance => instance.value.permissionScheme?.elemID.getFullName()
    === getChangeData(schemeChange).elemID.getFullName())

/**
 * Validates that a permission scheme deployment fits the license type
 * In cloud free tier you cannot create a new one
 */
export const permissionSchemeDeploymentValidator: (
  client: JiraClient,
) =>
  ChangeValidator = client => async (changes, elementsSource) =>
    log.time(async () => {
      if (client.isDataCenter || elementsSource === undefined) {
        return []
      }
      if (!await isFreeLicense(elementsSource)) {
        return []
      }
      const associatedPermissionSchemes = await awu(await elementsSource.list())
        .filter(id => id.idType === 'instance' && id.typeName === PROJECT_TYPE)
        .filter(async id => (await elementsSource.get(id)).value.permissionScheme !== undefined)
        .map(async id => (await elementsSource.get(id)).value.permissionScheme.elemID.getFullName())
        .toArray()
      // removal should not cause a warning if the project is also removed
      // addition changes should only cause a warning
      const associatedSchemeChangeErrors = changes
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === PERMISSION_SCHEME_TYPE_NAME)
        .filter(change => associatedPermissionSchemes.includes(getChangeData(change).elemID.getFullName()))
        .filter(change => !(isRemovalChange(change) && isSameChangeForProject(change, changes)))
        .map(change => ((isAdditionChange(change) && isSameChangeForProject(change, changes))
          ? schemeWarning(getChangeData(change).elemID)
          : schemeError(getChangeData(change).elemID)))
      // unassociated schemes can be edited, issue an error only if an addition
      // or if the association is removed in a different change
      // (the element source reflects the state after the changes)
      const unassociatedSchemeChangeErrors = changes
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === PERMISSION_SCHEME_TYPE_NAME)
        .filter(change => !associatedPermissionSchemes.includes(getChangeData(change).elemID.getFullName()))
        .filter(change => isAdditionChange(change)
          || wasSchemeAssociatedToAnyProjectBefore(change, changes))
        .map(change => schemeError(getChangeData(change).elemID))
      const projectChangeErrors = changes
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === PROJECT_TYPE)
        .filter(isAdditionOrModificationChange)
        .filter(isPermissionSchemeAssociationChange)
        .map(change => (isAdditionChange(change)
          ? projectWarning(getChangeData(change).elemID, change.data.after.value.permissionScheme.elemID.name)
          : projectError(getChangeData(change).elemID)))
      return [...associatedSchemeChangeErrors, ...unassociatedSchemeChangeErrors, ...projectChangeErrors]
    }, 'permission scheme validator')
