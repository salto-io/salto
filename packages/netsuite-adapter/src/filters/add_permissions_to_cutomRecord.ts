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

import { ElemID, ReferenceExpression, getChangeData, isInstanceChange, isObjectType, isReferenceExpression } from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { isCustomRecordType } from '../types'
import { ROLE, SCRIPT_ID } from '../constants'

const log = logger(module)

const filterCreator: LocalFilterCreator = () => ({
  name: 'addPermissions',
  preDeploy: async changes => {
    const customRecordChangesList = changes
      .map(getChangeData)
      .filter(isObjectType)
      .filter(isCustomRecordType)

    const customRecordScriptIdsList = customRecordChangesList
      .map(change => change.elemID.typeName)
    const roleChanges = changes
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === ROLE)
    if (customRecordScriptIdsList.length !== 0 && !_.isEmpty(roleChanges)) {
      customRecordChangesList
        .forEach(custRecordType => {
          if (_.isUndefined(custRecordType.annotations.permissions?.permission)) {
            custRecordType.annotations.permissions = {
              permission: {},
            }
          }
        })
      const regex = /^\[scriptid=(.+)\]$/
      // for (const role of roleChanges) {
      //   const permissionObject = role.value.permissions?.permission
      //   if (_.isPlainObject(permissionObject)) {
      //     for (const val of Object.values(permissionObject)) {
      //       if (values.isPlainRecord(val)) {
      //         if (isReferenceExpression(val.permkey)) {
      //           if (isObjectType(val.permkey.topLevelParent)
      //           && isCustomRecordType(val.permkey.topLevelParent)) {
      //             val.permkey.topLevelParent
      //               .annotations.permissions.permission[role.elemID.getFullNameParts()[0]] = {
      //                 permittedlevel: val.permlevel,
      //                 permittedrole: new ReferenceExpression(new ElemID(
      //                   `${role.elemID.getFullName()}.${SCRIPT_ID}`
      //                 )),
      //               }
      //             log.debug('')
      //           }
      //         } else if (_.isString(val.permkey) && regex.test(val.permkey)) {
      //           const match = regex.exec(val.permkey)
      //           const indexOfCustomRecord = match
      //             ? customRecordScriptIdsList.findIndex(scriptid => scriptid === match[1]) : -1
      //           if (indexOfCustomRecord !== -1) {
      //             const roleFullNameList = role.elemID.getFullNameParts()
      //             const roleName = roleFullNameList[roleFullNameList.length - 1]
      //             customRecordChangesList[indexOfCustomRecord]
      //               .annotations.permissions.permission[roleName] = {
      //                 permittedlevel: val.permlevel,
      //                 permittedrole: new ReferenceExpression(new ElemID(
      //                   `${role.elemID.getFullName()}.${SCRIPT_ID}`
      //                 )),
      //               }
      //           }
      //         }
      //       }
      //     }
      //   }
      // }
      roleChanges
        .forEach(role => {
          const permissionObject = role.value.permissions?.permission
          Object.values(permissionObject)
            .filter(values.isPlainRecord)
            .forEach(async val => {
              const roleFullNameList = role.elemID.getFullNameParts()
              const roleName = roleFullNameList[roleFullNameList.length - 1]
              if (isReferenceExpression(val.permkey)
                && isObjectType(val.permkey.topLevelParent)
                && isCustomRecordType(val.permkey.topLevelParent)) {
                val.permkey.topLevelParent.annotations.permissions.permission[roleName] = {
                  permittedlevel: val.permlevel,
                  permittedrole: new ReferenceExpression(new ElemID(`${role.elemID.getFullName()}.${SCRIPT_ID}`)),
                }
                log.debug('')
              } else if (_.isString(val.permkey) && regex.test(val.permkey)) {
                const match = regex.exec(val.permkey)
                const indexOfCustomRecord = match
                  ? customRecordScriptIdsList.findIndex(scriptid => scriptid === match[1]) : -1
                if (indexOfCustomRecord !== -1) {
                  customRecordChangesList[indexOfCustomRecord]
                    .annotations.permissions.permission[roleName] = {
                      permittedlevel: val.permlevel,
                      permittedrole: new ReferenceExpression(new ElemID(`${role.elemID.getFullName()}.${SCRIPT_ID}`)),
                    }
                }
              }
            })
        })
    }
    log.debug('')
  },
})

export default filterCreator
