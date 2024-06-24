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
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isReferenceExpression,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import { ROLE } from '../constants'
import { NetsuiteChangeValidator } from './types'
import { ID_TO_PERMISSION_INFO, PermissionLevel } from '../autogen/role_permissions/role_permissions'
import { captureServiceIdInfo } from '../service_id_info'

const { isDefined } = values
const log = logger(module)

type RolePermissionType = {
  permkey: string | ReferenceExpression
  permlevel: PermissionLevel
}

const permissionsToAdd: Readonly<Record<string, ReadonlySet<PermissionLevel>>> = {
  // mapping of permissions which aren't included in the documentation table
  LIST_BULK_PROCESSING: new Set(['VIEW']),
  LIST_ENTITYSUBSIDIARYRELATION: new Set(['VIEW']),
  ADMI_HTMLFORMULA: new Set(['FULL']),
  ADMI_RECORDS_CATALOG: new Set(['VIEW']),
  ADMI_SECRETS: new Set(['VIEW', 'CREATE', 'EDIT', 'FULL']),
  ADMI_SAC_READALL: new Set(['FULL']),
  ADMI_PROJECTTEMPLATE: new Set(['FULL']),
  ADMI_TYPE: new Set(['FULL']),
  ADMI_USER: new Set(['FULL']),
  ADMI_VICARIOUS_EMAILS: new Set(['FULL']),
  ADMI_WEBSERVICESOVERRIDESSTRING: new Set(['FULL']),
  GRAP_AP: new Set(['VIEW', 'NONE', 'CREATE', 'EDIT', 'FULL']),
  GRAP_AR: new Set(['VIEW', 'NONE', 'CREATE', 'EDIT', 'FULL']),
  GRAP_EXP: new Set(['VIEW', 'NONE', 'CREATE', 'EDIT', 'FULL']),
  GRAP_INC: new Set(['VIEW', 'NONE', 'CREATE', 'EDIT', 'FULL']),
  GRAP_NETWORTH: new Set(['VIEW', 'NONE', 'CREATE', 'EDIT', 'FULL']),
  LIST_AUDITTRAIL: new Set(['FULL']),
  LIST_COMPANY_FEATURE_SETUP: new Set(['VIEW']),
  LIST_GIFT_CERTIFICATE: new Set(['VIEW', 'CREATE', 'EDIT', 'FULL']),
  LIST_OTHER_ADDRESS: new Set(['FULL']),
  LIST_PUBLIC_TEMPLATE_CATEGORY: new Set(['FULL']),
  TRAN_GATEWAYNOTIFICATION: new Set(['VIEW', 'NONE', 'CREATE', 'EDIT', 'FULL']),
  TRAN_GENERATECHARGES: new Set(['VIEW', 'CREATE', 'FULL']),
  TRAN_VPREPAPPRV: new Set(['FULL']),
  REPO_CUSTOMIZATION: new Set(['FULL', 'VIEW', 'CREATE', 'EDIT']),
}

const isValidPermissions = ({ permkey, permlevel }: RolePermissionType): boolean => {
  const validPermissionLevels =
    typeof permkey === 'string' ? permissionsToAdd[permkey] ?? ID_TO_PERMISSION_INFO[permkey] : undefined
  if (!isDefined(validPermissionLevels)) {
    // in case of undocumented premission we log the id and ignore
    if (!isReferenceExpression(permkey) && captureServiceIdInfo(permkey).length === 0) {
      log.debug(`The following permissions does not appear in the documentation: ${permkey}`)
    }
    return true
  }
  return validPermissionLevels.has(permlevel)
}

const findInvalidPermissions = (roleInstance: InstanceElement): RolePermissionType[] => {
  const permissions: RolePermissionType[] = Object.values(roleInstance.value?.permissions?.permission ?? {})
  return permissions.filter(({ permkey, permlevel }) => !isValidPermissions({ permkey, permlevel }))
}

const changeValidator: NetsuiteChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(elem => elem.elemID.typeName === ROLE)
    .map(elem => {
      const invalidPermissionIds = findInvalidPermissions(elem).map(rolePermission => rolePermission.permkey)
      if (invalidPermissionIds.length !== 0) {
        return {
          elemID: elem.elemID,
          severity: 'Error',
          message: 'Role contains invalid permissions',
          detailedMessage: `The following permission IDs have invalid permissions, which prevent this role from being deployed: ${invalidPermissionIds.join(', ')}. Read more about valid permissions at https://help.salto.io/en/articles/7897170-deploying-elements-with-invalid-permissions.`,
        } as ChangeError
      }
      return undefined
    })
    .filter(isDefined)
export default changeValidator
