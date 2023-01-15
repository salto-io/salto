
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
import { BuiltinTypes, ElemID, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, isInstanceElement, isObjectType, ObjectType, TypeReference, Value } from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP, WalkOnFunc, setPath } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { ACCOUNT_ID_STRING, ACCOUNT_IDS_FIELDS_NAMES } from '../../constants'
import { FilterCreator } from '../../filter'
import { accountIdInfoType } from './types'

const { awu } = collections.asynciterable
const log = logger(module)

export const OWNER_STYLE_TYPES = ['Filter', 'Dashboard']
export const NON_DEPLOYABLE_TYPES = ['Board']
export const PARAMETER_STYLE_TYPES = ['PermissionScheme', 'NotificationScheme', 'SecurityLevel']
export const DEPLOYABLE_TYPES = [...PARAMETER_STYLE_TYPES,
  'Automation', 'Project', 'ProjectComponent', 'ProjectRole', 'Filter', 'Dashboard', 'CustomFieldContext', 'RoleActor']
export const ACCOUNT_ID_TYPES = [...NON_DEPLOYABLE_TYPES, ...DEPLOYABLE_TYPES]

const USER_TYPE = 'user'
const VALUE_FIELD = 'value'
const PARAMETER_FIELD = 'parameter'
const OWNER_FIELD = 'owner'

type AccountIdCacheInfo = {
  path: ElemID
  object: Value
}
type AccountIdsCache = Record<string, AccountIdCacheInfo[]>

const addToCache = (
  cache: AccountIdsCache,
  path: ElemID,
  objectToClone: Value
): void => {
  const key = path.createTopLevelParentID().parent.getFullName()
  if (_.isUndefined(cache[key])) {
    cache[key] = []
  }
  cache[key].push({ path, object: objectToClone })
}

export const isDeployableAccountIdType = (instanceElement: InstanceElement): boolean =>
  DEPLOYABLE_TYPES.includes(instanceElement.elemID.typeName)

const isAccountIdType = (instanceElement: InstanceElement): boolean =>
  ACCOUNT_ID_TYPES.includes(instanceElement.elemID.typeName)


export type WalkOnUsersCallback = (
  { value, path, fieldName }: { value: Value; path: ElemID; fieldName: string }) => void

const accountIdsScenarios = (
  value: Value,
  path: ElemID,
  callback: WalkOnUsersCallback
): void => {
  // main scenario, field is within the ACCOUNT_IDS_FIELDS_NAMES
  ACCOUNT_IDS_FIELDS_NAMES.forEach(fieldName => {
    if (Object.prototype.hasOwnProperty.call(value, fieldName)) {
      callback({ value, path, fieldName })
    }
  })
  // second scenario: the type has ACCOUNT_ID_STRING and the value holds the actual account id
  if (value.type === ACCOUNT_ID_STRING) {
    callback({ value, path, fieldName: VALUE_FIELD })
  }
  // third scenario the type is permissionHolder and the type is user
  // the id is in the parameter field. We cannot check type with walk on elements, so we
  // just check the two and verify it is within the known types
  if (PARAMETER_STYLE_TYPES.includes(path.typeName)
      && value.parameter !== undefined
      && _.toLower(value.type) === USER_TYPE) {
    callback({ value, path, fieldName: PARAMETER_FIELD })
  }
  // fourth scenario the type is Filter or Dashboard (coming from the user filter)
  // the value is under the owner field
  if (OWNER_STYLE_TYPES.includes(path.typeName)
      && value.owner !== undefined) {
    callback({ value, path, fieldName: OWNER_FIELD })
  }
  // fifth scenario the type is Board, inside the admins property there is a users
  // property that is a list of account ids without any additional parameter
  if (path.typeName === 'Board') {
    if (path.name === 'users'
        && Array.isArray(value)) {
      _.range(value.length).forEach(index => callback({
        value,
        path,
        fieldName: index.toString(),
      }))
    }
  }
}

export const walkOnUsers = (callback: WalkOnUsersCallback): WalkOnFunc => (
  ({ value, path }): WALK_NEXT_STEP => {
    if (isInstanceElement(value)) {
      if (!isAccountIdType(value)) {
        return WALK_NEXT_STEP.EXIT
      }
      accountIdsScenarios(value.value, path, callback)
    } else if (value !== undefined) {
      accountIdsScenarios(value, path, callback)
    }
    return WALK_NEXT_STEP.RECURSE
  })

const objectifyAccountId: WalkOnUsersCallback = ({ value, fieldName }): void => {
  value[fieldName] = {
    id: value[fieldName],
  }
}

const cacheAndSimplifyAccountId = (cache: AccountIdsCache): WalkOnUsersCallback => (
  { value, path, fieldName }
): void => {
  if (value[fieldName] !== undefined && path !== undefined) {
    addToCache(cache, path.createNestedID(fieldName), value[fieldName])
    value[fieldName] = value[fieldName].id
  }
}

const convertType = async (objectType: ObjectType): Promise<void> => {
  ACCOUNT_IDS_FIELDS_NAMES.forEach(async fieldName => {
    if (Object.prototype.hasOwnProperty.call(objectType.fields, fieldName)
      && (await objectType.fields[fieldName].getType()).elemID.isEqual(
        BuiltinTypes.STRING.elemID
      )) {
      objectType.fields[fieldName].refType = new TypeReference(
        accountIdInfoType.elemID,
        accountIdInfoType
      )
    }
  })
}
/*
 * A filter to change account ID from a string to an object that can contain
 * additional information.
 * The filter also removes this change pre-deploy, and return the original state
 * after onDeploy
 */
const filter: FilterCreator = () => {
  const cache: AccountIdsCache = {}
  return {
    onFetch: async elements => log.time(async () => {
      elements
        .filter(isInstanceElement)
        .forEach(element => {
          walkOnElement({ element, func: walkOnUsers(objectifyAccountId) })
        })
      await awu(elements)
        .filter(isObjectType)
        .filter(object => ACCOUNT_ID_TYPES.includes(object.elemID.typeName))
        .forEach(async objectType => {
          await convertType(objectType)
        })
    }, 'fetch account_id_filter'),
    preDeploy: async changes => {
      changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isDeployableAccountIdType)
        .forEach(element =>
          walkOnElement({ element, func: walkOnUsers(cacheAndSimplifyAccountId(cache)) }))
    },
    onDeploy: async changes => log.time(() => {
      changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .forEach(element => {
          cache[element.elemID.getFullName()]?.forEach(cacheInfo => {
            setPath(element, cacheInfo.path, cacheInfo.object)
          })
          return element
        })
    }, 'account_id_filter'),
  }
}
export default filter
