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
import { BuiltinTypes, ElemID, InstanceElement, ListType, ObjectType, Values } from '@salto-io/adapter-api'
import { accountIdInfoType } from '../../../src/filters/account_id/types'
import { JIRA } from '../../../src/constants'


export const createObjectedNestedType = (
  name: string
): ObjectType => new ObjectType({
  elemID: new ElemID(JIRA, name),
  fields:
  {
    str: { refType: BuiltinTypes.STRING },
    bool: { refType: BuiltinTypes.BOOLEAN },
    accountId: { refType: accountIdInfoType },
    leadAccountId: { refType: accountIdInfoType },
    authorAccountId: { refType: accountIdInfoType },
  },
})

export const createObjectedType = (
  name: string,
  nestedName = 'nested',
): ObjectType => {
  const nestedType = createObjectedNestedType(nestedName)
  return new ObjectType({
    elemID: new ElemID(JIRA, name),
    fields:
    {
      str: { refType: BuiltinTypes.STRING },
      bool: { refType: BuiltinTypes.BOOLEAN },
      accountId: { refType: accountIdInfoType },
      leadAccountId: { refType: accountIdInfoType },
      authorAccountId: { refType: accountIdInfoType },
      nested: { refType: nestedType },
    },
  })
}

export const createNestedType = (
  name: string
): ObjectType => new ObjectType({
  elemID: new ElemID(JIRA, name),
  fields:
  {
    str: { refType: BuiltinTypes.STRING },
    bool: { refType: BuiltinTypes.BOOLEAN },
    accountId: { refType: BuiltinTypes.STRING },
    leadAccountId: { refType: BuiltinTypes.STRING },
    authorAccountId: { refType: BuiltinTypes.STRING },
  },
})

export const createType = (
  name: string,
  nestedName = 'nested',
): ObjectType => {
  const nestedType = createNestedType(nestedName)
  return new ObjectType({
    elemID: new ElemID(JIRA, name),
    fields:
    {
      str: { refType: BuiltinTypes.STRING },
      bool: { refType: BuiltinTypes.BOOLEAN },
      accountId: { refType: BuiltinTypes.STRING },
      leadAccountId: { refType: BuiltinTypes.STRING },
      authorAccountId: { refType: BuiltinTypes.STRING },
      nested: { refType: nestedType },
    },
  })
}
export const createEmptyType = (type: string): ObjectType => new ObjectType({
  elemID: new ElemID(JIRA, type),
})

export const createBoardType = (): ObjectType => {
  const boardAdminsType = createEmptyType('Board_admins')
  const adminType = new ObjectType({
    elemID: new ElemID(JIRA, 'BoardAdmins'),
    fields: {
      users: { refType: new ListType(boardAdminsType) },
    },
  })
  return new ObjectType({
    elemID: new ElemID(JIRA, 'Board'),
    fields: {
      admins: { refType: adminType },
    },
  })
}

export const createFilterType = (): ObjectType => {
  const userType = createEmptyType('User')
  return new ObjectType({
    elemID: new ElemID(JIRA, 'Filter'),
    fields: {
      owner: { refType: userType },
    },
  })
}

export const createDashboardType = (): ObjectType => {
  const beanUserType = createEmptyType('UserBean')
  return new ObjectType({
    elemID: new ElemID(JIRA, 'Dashboard'),
    fields: {
      owner: { refType: beanUserType },
    },
  })
}

export const createFieldContextType = (): ObjectType => {
  const defaultValue = createEmptyType('DefaultValue')
  return new ObjectType({
    elemID: new ElemID(JIRA, 'CustomFieldContext'),
    fields: {
      defaultValue: { refType: defaultValue },
    },
  })
}

export const createInstance = (
  id: string,
  objectType: ObjectType,
  overrides: Values = {}
): InstanceElement => new InstanceElement(
  `inst${id}`,
  objectType,
  {
    str: 'str',
    bool: false,
    accountId: id,
    leadAccountId: `${id}l`,
    nested: {
      str: 'str internal',
      bool: false,
      accountId: `${id}n`,
      authorAccountId: `${id}an`,
      actor2: {
        type: 'ACCOUNT_ID',
        value: `${id}${id}n`,
      },
    },
    actor: {
      type: 'ACCOUNT_ID',
      value: `${id}${id}`,
    },
    holder: {
      type: 'User',
      parameter: `${id}h`,
    },
    list: [
      { accountId: `${id}list1` },
      { accountId: `${id}list2` },
    ],
    ...overrides,
  }
)

export const createObjectedInstance = (id: string, objectType: ObjectType): InstanceElement => {
  const object = createInstance(id, objectType, {
    accountId: {
      id,
    },
    leadAccountId: {
      id: `${id}l`,
    },
    nested: {
      accountId: {
        id: `${id}n`,
      },
      authorAccountId: {
        id: `${id}an`,
      },
      actor2: {
        type: 'ACCOUNT_ID',
        value: {
          id: `${id}${id}n`,
        },
      },
    },
    actor: {
      type: 'ACCOUNT_ID',
      value: {
        id: `${id}${id}`,
      },
    },
    holder: {
      type: 'User',
      parameter: {
        id: `${id}h`,
      },
    },
    list: [
      { accountId: {
        id: `${id}list1`,
      } },
      { accountId: {
        id: `${id}list2`,
      } },
    ],
  })
  return object
}

export const checkObjectedInstanceIds = (
  objInstance: InstanceElement, id: string,
  holderType = true
): void => {
  expect(objInstance.value.accountId.id).toEqual(id)
  expect(objInstance.value.actor.value.id).toEqual(`${id}${id}`)
  expect(objInstance.value.leadAccountId.id).toEqual(`${id}l`)
  expect(objInstance.value.nested.accountId.id).toEqual(`${id}n`)
  expect(objInstance.value.nested.authorAccountId.id).toEqual(`${id}an`)
  expect(objInstance.value.nested.actor2.value.id).toEqual(`${id}${id}n`)
  expect(objInstance.value.list[0].accountId.id).toEqual(`${id}list1`)
  expect(objInstance.value.list[1].accountId.id).toEqual(`${id}list2`)
  if (holderType) {
    expect(objInstance.value.holder.parameter.id).toEqual(`${id}h`)
  } else {
    expect(objInstance.value.holder.parameter).toEqual(`${id}h`)
  }
}

export const checkSimpleInstanceIds = (
  objInstance: InstanceElement,
  id: string
): void => {
  expect(objInstance.value.accountId).toEqual(id)
  expect(objInstance.value.actor.value).toEqual(`${id}${id}`)
  expect(objInstance.value.leadAccountId).toEqual(`${id}l`)
  expect(objInstance.value.nested.accountId).toEqual(`${id}n`)
  expect(objInstance.value.nested.authorAccountId).toEqual(`${id}an`)
  expect(objInstance.value.nested.actor2.value).toEqual(`${id}${id}n`)
  expect(objInstance.value.list[0].accountId).toEqual(`${id}list1`)
  expect(objInstance.value.list[1].accountId).toEqual(`${id}list2`)
  expect(objInstance.value.holder.parameter).toEqual(`${id}h`)
}
export const checkDisplayNames = (
  instance: InstanceElement,
  id: string,
  holderType = true
) : void => {
  expect(instance.value.accountId.displayName).toEqual(`disp${id}`)
  expect(instance.value.leadAccountId.displayName).toEqual(`disp${id}l`)
  expect(instance.value.nested.accountId.displayName).toEqual(`disp${id}n`)
  expect(instance.value.nested.authorAccountId.displayName).toEqual(`disp${id}an`)
  expect(instance.value.nested.actor2.value.displayName).toEqual(`disp${id}${id}n`)
  expect(instance.value.actor.value.displayName).toEqual(`disp${id}${id}`)
  expect(instance.value.list[0].accountId.displayName).toEqual(`disp${id}list1`)
  expect(instance.value.list[1].accountId.displayName).toEqual(`disp${id}list2`)
  if (holderType) {
    expect(instance.value.holder.parameter.displayName).toEqual(`disp${id}h`)
  }
}
export const checkInstanceUserIds = (
  instance: InstanceElement,
  id: string,
  prefix: string,
  holderType = true
) : void => {
  expect(instance.value.accountId.id).toEqual(`${prefix}${id}`)
  expect(instance.value.leadAccountId.id).toEqual(`${prefix}${id}l`)
  expect(instance.value.nested.accountId.id).toEqual(`${prefix}${id}n`)
  expect(instance.value.nested.authorAccountId.id).toEqual(`${prefix}${id}an`)
  expect(instance.value.nested.actor2.value.id).toEqual(`${prefix}${id}${id}n`)
  expect(instance.value.actor.value.id).toEqual(`${prefix}${id}${id}`)
  expect(instance.value.list[0].accountId.id).toEqual(`${prefix}${id}list1`)
  expect(instance.value.list[1].accountId.id).toEqual(`${prefix}${id}list2`)
  if (holderType) {
    expect(instance.value.holder.parameter.id).toEqual(`${prefix}${id}h`)
  }
}

export const createInstanceElementArrayWithDisplayNames = (
  size: number,
  objectType: ObjectType
): InstanceElement[] => {
  const elements: InstanceElement[] = []
  for (let i = 0; i < size; i += 1) {
    elements[i] = createObjectedInstance(i.toString(), objectType)
    elements[i].value.accountId.displayName = `disp${i}`
    elements[i].value.leadAccountId.displayName = `disp${i}l`
    elements[i].value.nested.accountId.displayName = `disp${i}n`
    elements[i].value.nested.authorAccountId.displayName = `disp${i}an`
    elements[i].value.nested.actor2.value.displayName = `disp${i}${i}n`
    elements[i].value.actor.value.displayName = `disp${i}${i}`
    elements[i].value.holder.parameter.displayName = `disp${i}h`
    elements[i].value.list[0].accountId.displayName = `disp${i}list1`
    elements[i].value.list[1].accountId.displayName = `disp${i}list2`
  }
  return elements
}
