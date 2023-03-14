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
import { createEmptyType } from '../../utils'
import { accountIdInfoType } from '../../../src/filters/account_id/types'
import { AUTOMATION_TYPE, BOARD_TYPE_NAME, JIRA } from '../../../src/constants'
import { OWNER_STYLE_TYPES, PARAMETER_STYLE_TYPES } from '../../../src/filters/account_id/account_id_filter'

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
      accountIds: { refType: new ListType(BuiltinTypes.STRING) },
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
    owner: `${id}owner`,
    users: [
      `${id}users1`,
      `${id}users2`,
    ],
    list: [
      { accountId: `${id}list1` },
      { accountId: `${id}list2` },
    ],
    value: {
      operations: [
        {
          fieldType: 'assignee',
          value: {
            type: 'ID',
            value: `${id}operations1`,
          },
        },
        {
          fieldType: 'assignee',
        },
        {
          fieldType: 'other',
          value: {
            type: 'ID',
            value: `${id}operations1`,
          },
        },
        {
          fieldType: 'assignee',
          value: {
            type: 'ID',
            value: `${id}operations1`,
          },
        },
      ],
    },
    automation1: {
      selectedFieldType: 'assignee',
      compareFieldValue: {
        type: 'ID',
        value: `${id}automation1`,
      },
    },
    automation2: {
      selectedFieldType: 'reporter',
      compareFieldValue: {
        type: 'ID',
        value: `${id}automation2`,
      },
    },
    automation3: {
      selectedFieldType: 'creator',
      compareFieldValue: {
        type: 'ID',
        value: `${id}automation3`,
      },
    },
    automation4: {
      selectedFieldType: 'com.atlassian.jira.plugin.system.customfieldtypes:multiuserpicker',
      compareFieldValue: {
        type: 'ID',
        value: `${id}automation4`,
      },
    },
    automation5: {
      selectedFieldType: 'com.atlassian.jira.plugin.system.customfieldtypes:userpicker',
      compareFieldValue: {
        type: 'ID',
        value: `${id}automation5`,
      },
    },
    automation9: {
      selectedFieldType: 'com.atlassian.servicedesk:sd-request-participants',
      compareFieldValue: {
        type: 'ID',
        value: `${id}automation9`,
      },
    },
    automation6: {
      fieldType: 'com.atlassian.jira.plugin.system.customfieldtypes:userpicker',
      compareFieldValue: {
        value: {
          operations: [
            {
              value: [
                {
                  type: 'ID',
                  value: `${id}automation6`,
                },
              ],
            },
          ],
        },
      },
    },
    automation7: {
      type: 'jira.user.condition',
      compareFieldValue: [
        {
          value: {
            conditions: [
              {
                nothing: 'else',
              },
              {
                criteria: [
                  {
                    type: 'ID',
                    value: `${id}automation7`,
                  },
                ],
              },
            ],
          },
        },
      ],
    },
    automation8: {
      type: 'jira.issue.assign',
      compareFieldValue: [
        {
          value: {
            assignee: {
              type: 'ID',
              values: [
                `${id}automation8a`,
                `${id}automation8b`,
              ],
            },
          },
        },
      ],
    },
    accountIds: [
      `${id}Ids1`,
      `${id}Ids2`,
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
    owner: {
      id: `${id}owner`,
    },
    users: [
      {
        id: `${id}users1`,
      },
      {
        id: `${id}users2`,
      },
    ],
    list: [
      { accountId: {
        id: `${id}list1`,
      } },
      { accountId: {
        id: `${id}list2`,
      } },
    ],
    value: {
      operations: [
        {
          fieldType: 'assignee',
          value: {
            type: 'ID',
            value: `${id}operations1`,
          },
        },
        {
          fieldType: 'assignee',
        },
        {
          fieldType: 'other',
          value: {
            type: 'ID',
            value: `${id}operations1`,
          },
        },
        {
          fieldType: 'assignee',
          value: {
            type: 'ID',
            value: {
              id: `${id}operations1`,
            },
          },
        },
      ],
    },
    automation1: {
      selectedFieldType: 'assignee',
      compareFieldValue: {
        type: 'ID',
        value: {
          id: `${id}automation1`,
        },
      },
    },
    automation2: {
      selectedFieldType: 'reporter',
      compareFieldValue: {
        type: 'ID',
        value: {
          id: `${id}automation2`,
        },
      },
    },
    automation3: {
      selectedFieldType: 'creator',
      compareFieldValue: {
        type: 'ID',
        value: {
          id: `${id}automation3`,
        },
      },
    },
    automation4: {
      selectedFieldType: 'com.atlassian.jira.plugin.system.customfieldtypes:multiuserpicker',
      compareFieldValue: {
        type: 'ID',
        value: {
          id: `${id}automation4`,
        },
      },
    },
    automation5: {
      selectedFieldType: 'com.atlassian.jira.plugin.system.customfieldtypes:userpicker',
      compareFieldValue: {
        type: 'ID',
        value: {
          id: `${id}automation5`,
        },
      },
    },
    automation9: {
      selectedFieldType: 'com.atlassian.servicedesk:sd-request-participants',
      compareFieldValue: {
        type: 'ID',
        value: {
          id: `${id}automation9`,
        },
      },
    },
    automation6: {
      fieldType: 'com.atlassian.jira.plugin.system.customfieldtypes:userpicker',
      compareFieldValue: {
        value: {
          operations: [
            {
              value: [
                {
                  type: 'ID',
                  value: {
                    id: `${id}automation6`,
                  },
                },
              ],
            },
          ],
        },
      },
    },
    automation7: {
      type: 'jira.user.condition',
      compareFieldValue: [
        {
          value: {
            conditions: [
              {
                nothing: 'else',
              },
              {
                criteria: [
                  {
                    type: 'ID',
                    value: {
                      id: `${id}automation7`,
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    },
    automation8: {
      type: 'jira.issue.assign',
      compareFieldValue: [
        {
          value: {
            assignee: {
              type: 'ID',
              values: [
                {
                  id: `${id}automation8a`,
                },
                {
                  id: `${id}automation8b`,
                },
              ],
            },
          },
        },
      ],
    },
    accountIds: [
      {
        id: `${id}Ids1`,
      },
      {
        id: `${id}Ids2`,
      },
    ],
  })
  return object
}

export const checkObjectedInstanceIds = (
  objInstance: InstanceElement, id: string,
): void => {
  const type = objInstance.elemID.typeName
  expect(objInstance.value.accountId.id).toEqual(id)
  expect(objInstance.value.actor.value.id).toEqual(`${id}${id}`)
  expect(objInstance.value.leadAccountId.id).toEqual(`${id}l`)
  expect(objInstance.value.nested.accountId.id).toEqual(`${id}n`)
  expect(objInstance.value.nested.authorAccountId.id).toEqual(`${id}an`)
  expect(objInstance.value.nested.actor2.value.id).toEqual(`${id}${id}n`)
  expect(objInstance.value.list[0].accountId.id).toEqual(`${id}list1`)
  expect(objInstance.value.list[1].accountId.id).toEqual(`${id}list2`)
  expect(PARAMETER_STYLE_TYPES.includes(type)
    ? objInstance.value.holder.parameter.id
    : objInstance.value.holder.parameter).toEqual(`${id}h`)
  if (type === AUTOMATION_TYPE) {
    expect(objInstance.value.value.operations[3].value.value.id).toEqual(`${id}operations1`)
    expect(objInstance.value.automation1.compareFieldValue.value.id).toEqual(`${id}automation1`)
    expect(objInstance.value.automation2.compareFieldValue.value.id).toEqual(`${id}automation2`)
    expect(objInstance.value.automation3.compareFieldValue.value.id).toEqual(`${id}automation3`)
    expect(objInstance.value.automation4.compareFieldValue.value.id).toEqual(`${id}automation4`)
    expect(objInstance.value.automation5.compareFieldValue.value.id).toEqual(`${id}automation5`)
    expect(objInstance.value.automation9.compareFieldValue.value.id).toEqual(`${id}automation9`)
    expect(objInstance.value.automation6.compareFieldValue.value.operations[0].value[0].value.id).toEqual(`${id}automation6`)
    expect(objInstance.value.automation7.compareFieldValue[0].value.conditions[1].criteria[0].value.id).toEqual(`${id}automation7`)
    expect(objInstance.value.automation8.compareFieldValue[0].value.assignee.values[0].id).toEqual(`${id}automation8a`)
    expect(objInstance.value.automation8.compareFieldValue[0].value.assignee.values[1].id).toEqual(`${id}automation8b`)
    expect(objInstance.value.accountIds[0].id).toEqual(`${id}Ids1`)
    expect(objInstance.value.accountIds[1].id).toEqual(`${id}Ids2`)
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
  const type = objInstance.elemID.typeName
  if (type === AUTOMATION_TYPE) {
    expect(objInstance.value.value.operations[3].value.value).toEqual(`${id}operations1`)
    expect(objInstance.value.automation1.compareFieldValue.value).toEqual(`${id}automation1`)
    expect(objInstance.value.automation2.compareFieldValue.value).toEqual(`${id}automation2`)
    expect(objInstance.value.automation3.compareFieldValue.value).toEqual(`${id}automation3`)
    expect(objInstance.value.automation4.compareFieldValue.value).toEqual(`${id}automation4`)
    expect(objInstance.value.automation5.compareFieldValue.value).toEqual(`${id}automation5`)
    expect(objInstance.value.automation9.compareFieldValue.value).toEqual(`${id}automation9`)
    expect(objInstance.value.automation6.compareFieldValue.value.operations[0].value[0].value).toEqual(`${id}automation6`)
    expect(objInstance.value.automation7.compareFieldValue[0].value.conditions[1].criteria[0].value).toEqual(`${id}automation7`)
    expect(objInstance.value.automation8.compareFieldValue[0].value.assignee.values[0]).toEqual(`${id}automation8a`)
    expect(objInstance.value.automation8.compareFieldValue[0].value.assignee.values[1]).toEqual(`${id}automation8b`)
    expect(objInstance.value.accountIds[0]).toEqual(`${id}Ids1`)
    expect(objInstance.value.accountIds[1]).toEqual(`${id}Ids2`)
  }
}
export const checkDisplayNames = (
  instance: InstanceElement,
  id: string
) : void => {
  const type = instance.elemID.typeName
  expect(instance.value.accountId.displayName).toEqual(`disp${id}`)
  expect(instance.value.leadAccountId.displayName).toEqual(`disp${id}l`)
  expect(instance.value.nested.accountId.displayName).toEqual(`disp${id}n`)
  expect(instance.value.nested.authorAccountId.displayName).toEqual(`disp${id}an`)
  expect(instance.value.nested.actor2.value.displayName).toEqual(`disp${id}${id}n`)
  expect(instance.value.actor.value.displayName).toEqual(`disp${id}${id}`)
  expect(instance.value.list[0].accountId.displayName).toEqual(`disp${id}list1`)
  expect(instance.value.list[1].accountId.displayName).toEqual(`disp${id}list2`)
  if (PARAMETER_STYLE_TYPES.includes(type)) {
    expect(instance.value.holder.parameter.displayName).toEqual(`disp${id}h`)
  }
  if (OWNER_STYLE_TYPES.includes(type)) {
    expect(instance.value.owner.displayName).toEqual(`disp${id}owner`)
  }
  if (type === BOARD_TYPE_NAME) {
    expect(instance.value.users[0].displayName).toEqual(`disp${id}users1`)
    expect(instance.value.users[1].displayName).toEqual(`disp${id}users2`)
  }
  if (type === AUTOMATION_TYPE) {
    expect(instance.value.value.operations[3].value.value.displayName).toEqual(`disp${id}operations1`)
    expect(instance.value.automation1.compareFieldValue.value.displayName).toEqual(`disp${id}automation1`)
    expect(instance.value.automation2.compareFieldValue.value.displayName).toEqual(`disp${id}automation2`)
    expect(instance.value.automation3.compareFieldValue.value.displayName).toEqual(`disp${id}automation3`)
    expect(instance.value.automation4.compareFieldValue.value.displayName).toEqual(`disp${id}automation4`)
    expect(instance.value.automation5.compareFieldValue.value.displayName).toEqual(`disp${id}automation5`)
    expect(instance.value.automation9.compareFieldValue.value.displayName).toEqual(`disp${id}automation9`)
    expect(instance.value.automation6.compareFieldValue.value.operations[0].value[0].value.displayName).toEqual(`disp${id}automation6`)
    expect(instance.value.automation7.compareFieldValue[0].value.conditions[1].criteria[0].value.displayName).toEqual(`disp${id}automation7`)
    expect(instance.value.automation8.compareFieldValue[0].value.assignee.values[0].displayName).toEqual(`disp${id}automation8a`)
    expect(instance.value.automation8.compareFieldValue[0].value.assignee.values[1].displayName).toEqual(`disp${id}automation8b`)
  }
  expect(instance.value.accountIds[0].displayName).toEqual(`disp${id}Ids1`)
  expect(instance.value.accountIds[1].displayName).toEqual(`disp${id}Ids2`)
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
  expect(instance.value.value.operations[3].value.value.id).toEqual(`${id}operations1`)
  expect(instance.value.accountIds[0].id).toEqual(`${prefix}${id}Ids1`)
  expect(instance.value.accountIds[1].id).toEqual(`${prefix}${id}Ids2`)
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
    elements[i].value.value.operations[3].value.displayName = `disp${i}operations1`
    elements[i].value.owner.displayName = `disp${i}owner`
    elements[i].value.users[0].displayName = `disp${i}users1`
    elements[i].value.users[1].displayName = `disp${i}users2`
    elements[i].value.accountIds[0].displayName = `disp${i}Ids1`
    elements[i].value.accountIds[1].displayName = `disp${i}Ids2`
  }
  return elements
}
