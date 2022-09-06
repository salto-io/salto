
/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, Change, ElemID, InstanceElement, isInstanceChange, isInstanceElement, isObjectType, isRemovalChange, ObjectType, TypeReference, Value } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, walkOnElement, WALK_NEXT_STEP, WalkOnFunc, setPath } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { ACCOUNT_ID_STRING, ACCOUNT_IDS_FIELDS_NAMES, USER } from '../../constants'
import { FilterCreator } from '../../filter'
import { accountIdInfoType } from './types'

const { awu } = collections.asynciterable
const log = logger(module)

export const PARAMETER_STYLE_TYPES = ['PermissionScheme', 'NotificationScheme', 'SecurityLevel']
export const ACCOUNT_ID_TYPES = PARAMETER_STYLE_TYPES.concat(['Automation', 'Project', 'ProjectComponent', 'ProjectRole'])

type AccountIdCacheInfo = {
  path: ElemID
  object: Value
}
type AccountIdsCache = Record<string, AccountIdCacheInfo[]>

const addToCache = (
  cache: AccountIdsCache,
  path: ElemID,
  objectToClone: Value
):void => {
  const key = path.createTopLevelParentID().parent.getFullName()
  if (_.isUndefined(cache[key])) {
    cache[key] = []
  }
  cache[key].push({ path, object: _.cloneDeep(objectToClone) })
}

export const isAccountIdType = (instanceElement: InstanceElement): boolean =>
  ACCOUNT_ID_TYPES.includes(instanceElement.elemID.typeName)

export const isPermissionHolderCase = (
  value: Value,
  path: ElemID
): boolean => PARAMETER_STYLE_TYPES.includes(path.typeName)
    && !_.isUndefined(value.parameter)
    && _.toLower(value.type) === USER

const objectifyAccountId = (value: Value, path: ElemID):void => {
  // main scenario, field is within the ACCOUNT_IDS_FIELDS_NAMES
  ACCOUNT_IDS_FIELDS_NAMES.forEach(fieldName => {
    if (Object.prototype.hasOwnProperty.call(value, fieldName)) {
      value[fieldName] = {
        id: value[fieldName],
      }
    }
  })
  // second scenario: the type has ACCOUNT_ID_STRING and the value holds the actual account id
  if (value.type === ACCOUNT_ID_STRING) {
    value.value = {
      id: value.value,
    }
  }
  // third scenario the type is permissionHolder and the type is user
  // the id is in the parameter field. We cannot check type with walk on elements, so we
  // just check the two and verify it is within the known types
  if (isPermissionHolderCase(value, path)) {
    value.parameter = {
      id: value.parameter,
    }
  }
}

const objectifyAccountIdsWalk: WalkOnFunc = ({ value, path }):WALK_NEXT_STEP => {
  if (isInstanceElement(value)) {
    objectifyAccountId(value.value, path)
  } else {
    objectifyAccountId(value, path)
  }
  return WALK_NEXT_STEP.RECURSE
}

const storeAndSimplifyAccountIds = (
  value: Value,
  path: ElemID,
  cache: AccountIdsCache
): void => {
  // main scenario, field is within the ACCOUNT_IDS_FIELDS_NAMES
  ACCOUNT_IDS_FIELDS_NAMES.forEach(fieldName => {
    if (Object.prototype.hasOwnProperty.call(value, fieldName)
    && !_.isUndefined(value[fieldName].id)
    ) {
      addToCache(cache, path.createNestedID(fieldName), value[fieldName])
      value[fieldName] = value[fieldName].id
    }
  })
  // second scenario: the type has ACCOUNT_ID_STRING and the value holds the actual account id
  if (value.type === ACCOUNT_ID_STRING
    && !_.isUndefined(value.value.id)) {
    addToCache(cache, path.createNestedID('value'), value.value)
    value.value = value.value.id
  }
  // third scenario the type is permissionHolder and the type is user
  // the id is in the parameter field. We cannot check type with walk on elements, so we
  // just check the two and verify it is within the known types
  if (isPermissionHolderCase(value, path)
    && !_.isUndefined(value.parameter)
  ) {
    addToCache(cache, path.createNestedID('parameter'), value.parameter)
    value.parameter = value.parameter.id
  }
}

const cacheAndSimplifyAccountIdWalk = (cache: AccountIdsCache): WalkOnFunc =>
  ({ value, path }):WALK_NEXT_STEP => {
    if (_.isUndefined(value)) {
      return WALK_NEXT_STEP.SKIP
    }
    if (isInstanceElement(value) && !_.isUndefined(value.value)) {
      storeAndSimplifyAccountIds(value.value, path, cache)
    } else {
      storeAndSimplifyAccountIds(value, path, cache)
    }
    return WALK_NEXT_STEP.RECURSE
  }


const convertType = async (objectType: ObjectType):Promise<void> => {
  ACCOUNT_IDS_FIELDS_NAMES.forEach(async fieldName => {
    if (Object.prototype.hasOwnProperty.call(objectType.fields, fieldName)
      && await objectType.fields[fieldName].getType() === BuiltinTypes.STRING) {
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
        .filter(isAccountIdType)
        .forEach(element => {
          walkOnElement({ element, func: objectifyAccountIdsWalk })
        })
      await awu(elements)
        .filter(isObjectType)
        .forEach(async objectType => {
          await convertType(objectType)
        })
    }, 'fetch account_id_filter'),
    preDeploy: async changes => {
      await awu(changes)
        .filter(isInstanceChange)
        .filter(change => !isRemovalChange(change))
        .forEach(async change => {
          await applyFunctionToChangeData<Change<InstanceElement>>(
            change,
            element => {
              if (isAccountIdType(element)) {
                walkOnElement({ element, func: cacheAndSimplifyAccountIdWalk(cache) })
              }
              return element
            }
          )
        })
    },
    onDeploy: async changes => log.time(async () => {
      await awu(changes)
        .filter(isInstanceChange)
        .filter(change => !isRemovalChange(change))
        .forEach(async change => {
          await applyFunctionToChangeData<Change<InstanceElement>>(
            change,
            element => {
              cache[element.elemID.getFullName()]?.forEach(cacheInfo => {
                setPath(element, cacheInfo.path, cacheInfo.object)
              })
              return element
            }
          )
        })
    }, 'account_id_filter'),
  }
}
export default filter
