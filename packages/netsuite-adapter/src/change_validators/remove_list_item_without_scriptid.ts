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
import _ from 'lodash'
import {
  isModificationChange, InstanceElement, isInstanceChange,
  Value,
  ReferenceExpression,
  ModificationChange,
  ElemID,
  ChangeError,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { NetsuiteChangeValidator } from './types'
import { ROLE } from '../constants'


const { awu } = collections.asynciterable

const PERMISSIONS = 'permissions'
const PERMISSION = 'permission'
const PERMKEY = 'permkey'
const PERMLEVEL = 'permlevel'
const RESTRICTION = 'restriction'

type RolePermissionObject = {
  [PERMKEY]: string | ReferenceExpression
  [PERMLEVEL]: string
  [RESTRICTION]?: string
}

export type ItemInList = RolePermissionObject

type GetItemList = (instance: InstanceElement) => ItemInList[]
type GetItemString = (item: ItemInList) => string
type GetItemByID = (instance: InstanceElement, id: string) => ItemInList | undefined
type GetListPath = () => string[]
type GetMessage = (removedListItems: string[]) => string

const getMessageByElementNameAndListItems = (elemName: string, removedListItems: string[]): string =>
  `Can't remove the inner ${elemName}${removedListItems.length > 1 ? 's' : ''} ${removedListItems.join(', ')}. NetSuite supports the removal of inner elements only from its UI.`

export type ItemListGetters = {
  getItemList: GetItemList
  getItemString: GetItemString
  getItemByID: GetItemByID
  getListPath: GetListPath
  getDetailedMessage: GetMessage
}

const isRolePermissionObject = (obj: Value): obj is RolePermissionObject =>
  (typeof obj[PERMKEY] === 'string' || isReferenceExpression(obj[PERMKEY]))
  && typeof obj[PERMLEVEL] === 'string'
  && ((typeof obj[RESTRICTION] === 'string') || !(RESTRICTION in obj))

const getRoleListPath: GetListPath = () => [
  PERMISSIONS,
  PERMISSION,
]

const getRolePermissionList:GetItemList = (
  instance: InstanceElement,
): RolePermissionObject[] => {
  const listPathValue = _.get(instance.value, getRoleListPath())
  if (_.isPlainObject(listPathValue)) {
    return Object.values(listPathValue)
      .filter(isRolePermissionObject)
  }
  return [] as RolePermissionObject[]
}

const getRolePermkey: GetItemString = (
  permission: RolePermissionObject
): string => {
  const permkey = permission[PERMKEY]
  if (_.isString(permkey)) {
    return permkey
  }
  return permkey.value
}

const getRolePermissionByName = (
  role: InstanceElement,
  id: string,
): RolePermissionObject | undefined => (
  _.isPlainObject(role.value[PERMISSIONS]?.[PERMISSION])
    ? Object.values(role.value[PERMISSIONS]?.[PERMISSION])
      .filter(isRolePermissionObject)
      .find(permObj => getRolePermkey(permObj) === id)
    : undefined
)

const getRoleMessage = (removedListItems: string[]): string =>
  getMessageByElementNameAndListItems(PERMISSION, removedListItems)

export const roleGetters: ItemListGetters = {
  getItemList: getRolePermissionList,
  getItemString: getRolePermkey,
  getItemByID: getRolePermissionByName,
  getListPath: getRoleListPath,
  getDetailedMessage: getRoleMessage,
}

export const getGettersByType = (
  typename: string,
): ItemListGetters | undefined => {
  if (typename === ROLE) {
    return roleGetters
  }
  return undefined
}
const getIdentifierList = (
  instance: InstanceElement,
  getters: ItemListGetters,
): string[] =>
  getters.getItemList(instance).map(getters.getItemString)

export const getRemovedListItemDetails = (
  instanceChange: ModificationChange<InstanceElement>,
): {
  removedListItems: string[]
  elemID: ElemID
  detailedMessage: string
} => {
  const getters = getGettersByType(instanceChange.data.before.elemID.typeName)
  if (getters === undefined) {
    return { removedListItems: [], elemID: instanceChange.data.before.elemID, detailedMessage: '' }
  }
  const { before, after } = instanceChange.data
  const beforeItemList = getIdentifierList(before, getters)
  const afterItemSet = new Set<string>(getIdentifierList(after, getters))
  const removedListItems = beforeItemList.filter(id => !afterItemSet.has(id))
  return {
    removedListItems,
    elemID: before.elemID,
    detailedMessage: getters.getDetailedMessage(removedListItems),
  }
}

const changeValidator: NetsuiteChangeValidator = async changes => {
  const instanceChanges = await awu(changes)
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .toArray() as ModificationChange<InstanceElement>[]

  return instanceChanges
    .map(getRemovedListItemDetails)
    .filter(({ removedListItems }) => !_.isEmpty(removedListItems))
    .map(({ detailedMessage, elemID }) => ({
      elemID,
      severity: 'Warning',
      message: 'Can\'t remove inner elements',
      detailedMessage,
    })) as ChangeError[]
}

export default changeValidator
