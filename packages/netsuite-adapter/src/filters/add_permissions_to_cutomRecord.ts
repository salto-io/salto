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

import { InstanceElement, ObjectType, ReadOnlyElementsSource, ReferenceExpression, getChangeData, isInstanceChange, isObjectType, isReferenceExpression } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values, collections } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { isCustomRecordType } from '../types'
import { ROLE, SCRIPT_ID } from '../constants'

const log = logger(module)
const { awu } = collections.asynciterable

const addPermissionField = (custRecordMap: Map<string, ObjectType>): void =>
  custRecordMap.forEach(value => {
    if (value.annotations.permissions?.permission === undefined) {
      value.annotations.permissions = {
        permission: {},
      }
    }
  })

const createRoleToPermittedroleMap = async (
  roles: InstanceElement[],
  elementsSource: ReadOnlyElementsSource,
): Promise<Map<string, ReferenceExpression>> =>
  new Map<string, ReferenceExpression>(
    await awu(roles)
      .map(async (role): Promise<[string, ReferenceExpression]> => {
        const roleFullNameList = role.elemID.getFullNameParts()
        const roleName = roleFullNameList[roleFullNameList.length - 1]
        const permittedrole = new ReferenceExpression(role.elemID.createNestedID(SCRIPT_ID))
        permittedrole.topLevelParent = await elementsSource.get(
          permittedrole.elemID.createTopLevelParentID().parent
        )
        return [roleName, permittedrole]
      })
      .toArray()
  )

const addPermissionToCustomRecordTypes = (
  val: Record<string, unknown>,
  customRecordChangedMap: Map<string, ObjectType>,
  roleName: string,
  roleToPermittedroleMap: Map<string, ReferenceExpression>,
): void => {
  if (isReferenceExpression(val.permkey)
      && isObjectType(val.permkey.topLevelParent)
      && isCustomRecordType(val.permkey.topLevelParent)) {
    const custRecord = customRecordChangedMap.get(val.permkey.topLevelParent.elemID.typeName)
    if (custRecord !== undefined) {
      custRecord.annotations.permissions.permission[roleName] = {
        permittedlevel: val.permlevel,
        permittedrole: roleToPermittedroleMap.get(roleName),
      }
    }
  }
}
const addPermissionsToCustomRecordTypes = (
  roles: InstanceElement[],
  customRecordChangedMap: Map<string, ObjectType>,
  roleToPermittedroleMap: Map<string, ReferenceExpression>,
): void =>
  roles.forEach(role => {
    const permissionObject = role.value.permissions?.permission
    const roleFullNameList = role.elemID.getFullNameParts()
    const roleName = roleFullNameList[roleFullNameList.length - 1]
    if (values.isPlainRecord(permissionObject)) {
      Object.values(permissionObject)
        .filter(values.isPlainRecord)
        .forEach(async val => {
          addPermissionToCustomRecordTypes(val, customRecordChangedMap, roleName, roleToPermittedroleMap)
        })
    }
  })

const filterCreator: LocalFilterCreator = ({ elementsSource }) => ({
  name: 'addPermissions',
  preDeploy: async changes => {
    const customRecordChangedMap = new Map<string, ObjectType>(changes
      .map(getChangeData)
      .filter(isObjectType)
      .filter(isCustomRecordType)
      .map(custRecord => [custRecord.elemID.typeName, custRecord]))

    const roleChanged = changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === ROLE)

    if (customRecordChangedMap.size > 0 && roleChanged.length > 0) {
      addPermissionField(customRecordChangedMap)

      const roleToPermittedroleMap = await createRoleToPermittedroleMap(roleChanged, elementsSource)

      addPermissionsToCustomRecordTypes(roleChanged, customRecordChangedMap, roleToPermittedroleMap)
    }
    log.debug('')
  },
})

export default filterCreator
