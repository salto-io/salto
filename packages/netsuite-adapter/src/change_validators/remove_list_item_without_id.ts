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
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { NetsuiteChangeValidator } from './types'
import { ROLE } from '../constants'


const { awu } = collections.asynciterable

type GetItemList = (instance: InstanceElement) => Value[]
type GetItemString = (item: Value) => string

type PermissionObject = {
  permkey: string | ReferenceExpression
  permlevel: string
}

type ItemListGetters = {
  getItemList: GetItemList
  getItemString: GetItemString
}

const getRolePermissionList:GetItemList = (
  instance: InstanceElement,
): Value[] => {
  if (_.isPlainObject(instance.value.permissions?.permission)) {
    return Object.values(instance.value.permissions?.permission)
  }
  return []
}

const getRolePermkey: GetItemString = (
  permission: PermissionObject
): string => {
  if (_.isString(permission.permkey)) {
    return permission.permkey
  }
  return permission.permkey.value
}

const roleGetters: ItemListGetters = {
  getItemList: getRolePermissionList,
  getItemString: getRolePermkey,
}

const getGettersByType = (
  typename: string,
): ItemListGetters | undefined => {
  if (typename === ROLE) {
    return roleGetters
  }
  return undefined
}
const getIdentifierList = (
  instance: InstanceElement,
): string[] => {
  const getters = getGettersByType(instance.elemID.typeName)
  if (getters === undefined) {
    return []
  }
  return getters.getItemList(instance).map(getters.getItemString)
}

const getRemovedListItems = (
  instanceChange: ModificationChange<InstanceElement>,
): { removedListItems: string[]; elemID: ElemID} => {
  const { before, after } = instanceChange.data
  const beforeItemList = getIdentifierList(before)
  const afterItemSet = new Set<string>(getIdentifierList(after))
  return {
    removedListItems: beforeItemList
      .filter(id => !afterItemSet.has(id)),
    elemID: before.elemID,
  }
}

const changeValidator: NetsuiteChangeValidator = async changes => {
  const instanceChanges = await awu(changes)
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .toArray() as ModificationChange<InstanceElement>[]

  return instanceChanges
    .map(getRemovedListItems)
    .filter(({ removedListItems }) => !_.isEmpty(removedListItems))
    .map(({ removedListItems, elemID }) => ({
      elemID,
      severity: 'Warning',
      message: 'Can\'t remove inner elements',
      detailedMessage: `Can't remove the inner element${removedListItems.length > 1 ? 's' : ''} ${removedListItems.join(', ')}. NetSuite supports the removal of inner elements only from their UI.`,
    })) as ChangeError[]
}

export default changeValidator
