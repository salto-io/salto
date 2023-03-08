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

import { WalkOnFunc, walkOnValue, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { isInstanceElement, Element, isInstanceChange, isAdditionOrModificationChange, getChangeData, Value } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { WORKFLOW_TYPE_NAME } from '../../constants'
import { SCRIPT_RUNNER_DC_TYPES } from './workflow_dc'


const SCRIPT_RUNNER_OR = '|||'
export const OR_FIELDS = [
  'FIELD_TRANSITION_OPTIONS',
  'FIELD_SELECTED_FIELDS',
  'FIELD_LINK_DIRECTION',
  'FIELD_FIELD_IDS',
  'FIELD_REQUIRED_FIELDS',
  'FIELD_USER_IN_FIELDS',
  'FIELD_GROUP_NAMES',
  'FIELD_LINKED_ISSUE_RESOLUTION',
  'FIELD_PROJECT_ROLE_IDS',
  'FIELD_USER_IDS',
  'FIELD_LINKED_ISSUE_STATUS',
]

export const MAIL_LISTS_FIELDS = [
  'FIELD_TO_USER_FIELDS',
  'FIELD_CC_USER_FIELDS',
]

const GROUP_PREFIX = 'group:'
const ROLE_PREFIX = 'role:'
const SPACE = ' '
const FIELD_LINK_DIRECTION = 'FIELD_LINK_DIRECTION'

const stringifyDirectionFields = (value: Value): void => {
  if (_.isPlainObject(value)) {
    Object.entries(value)
      .filter(([key]) => key === FIELD_LINK_DIRECTION)
      .filter((entry): entry is [string, { linkType: string; direction: string }[]] => Array.isArray(entry[1]))
      .forEach(([key, val]) => {
        value[key] = val.map((directionObj: { linkType: string; direction: string }) => `${directionObj.linkType}-${directionObj.direction}`)
      })
  }
}

const objectifyDirectionFields = (value: Value): void => {
  if (_.isPlainObject(value)) {
    Object.entries(value)
      .filter(([key]) => key === FIELD_LINK_DIRECTION)
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
      .forEach(([key, val]) => {
        value[key] = val.map((directionString: string) => {
          const [id, direction] = directionString.split('-')
          return { linkType: id, direction }
        }).sort() // sort to make sure the order is consistent
      })
  }
}


// splits a string by spaces that are not in quotes
// for example:
// group:"spaces spaces" assignee watchers group:jira-software-users
// will be split to:
// ['group:"spaces spaces"', 'assignee', 'watchers', 'group:jira-software-users']
const splitBySpaceNotInQuotes = (input: string): string[] =>
// regex breakdown: the logic is to match a space that is followed by an even number of quotes
// (?= is called Positive Lookahead, meaning what follows should be there but is not part of the match
// (?: is called Non-capturing group, meaning it is a group but it is not captured
// [^"]*" is any number of characters that arw not a quote, followed by a quote
// {2} means that the previous group should be repeated 2 times
// )* means that the previous group should be repeated any number of times
// [^"]*$ means that the string should end with any number of characters that are not a quote
  input.split(/ (?=(?:(?:[^"]*"){2})*[^"]*$)/)

const quoteIfSpaces = (str: string): string => (str.includes(SPACE) ? `"${str}"` : str)

type MailListObject = {
  group?: string[]
  role?: string[]
  field?: string[]
}

const joinWithPrefixes = (object: MailListObject | undefined): string => {
  if (object === undefined) {
    return ''
  }
  const { group = [], role = [], field = [] } = object
  const prefixedGroup = group.map((groupItem: string) => GROUP_PREFIX + quoteIfSpaces(groupItem))
    .join(SPACE)
  const prefixedRole = role.map((roleItem: string) => ROLE_PREFIX + quoteIfSpaces(roleItem))
    .join(SPACE)
  const plainField = field.join(SPACE)
  return [prefixedGroup, prefixedRole, plainField].filter(Boolean).join(SPACE)
}

const returnMailLists = (value: Value): void => {
  if (_.isPlainObject(value)) {
    Object.entries(value)
      .filter(([key]) => MAIL_LISTS_FIELDS.includes(key))
      .forEach(([key, val]) => {
        value[key] = joinWithPrefixes(val as MailListObject)
      })
  }
}

// creates an object with the 3 types of items (group, role, field) by the prefixes
const createEmailObject = (values: string[]): MailListObject => {
  const emailObject: MailListObject = values.reduce((result:
    MailListObject, str: string) => {
    if (str.startsWith(GROUP_PREFIX)) {
      return { ...result, group: [...result.group as string[], str.slice(GROUP_PREFIX.length)] }
    }
    if (str.startsWith(ROLE_PREFIX)) {
      return { ...result, role: [...result.role as string[], str.slice(ROLE_PREFIX.length)] }
    }
    return { ...result, field: [...result.field as string[], str] }
  }, { group: [], role: [], field: [] })
  return Object.fromEntries(
    Object.entries(emailObject)
      .filter(([_key, val]) => val?.length !== 0)
      .map(([key, val]) => [key, val?.sort()]) // keep the order in each list
      .sort()
  )
}

// mail lists are space separated, but we want to keep the spaces inside quotes
// they can contain 3 types of items- fields, groups and roles. groups and roles have prefixes
// and example: assignee watchers group:jira-software-users role:Administrators group:\"spaces spaces\"
const replaceMailLists = (value: Value): void => {
  if (_.isPlainObject(value)) {
    Object.entries(value)
      .filter(([key]) => MAIL_LISTS_FIELDS.includes(key))
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .forEach(([key, val]) => {
        const valuesArr = splitBySpaceNotInQuotes(val)
          .map((token: string) => token.replace(/"/g, '')) // remove quotes
        value[key] = createEmailObject(valuesArr)
      })
  }
}

const returnOr = (value: Value): void => {
  if (_.isPlainObject(value)) {
    Object.entries(value)
      .filter(([key]) => OR_FIELDS.includes(key))
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
      .forEach(([key, val]) => {
        value[key] = val.join(SCRIPT_RUNNER_OR)
      })
  }
}

const replaceOr = (value: Value): void => {
  if (_.isPlainObject(value)) {
    Object.entries(value)
      .filter(([key]) => OR_FIELDS.includes(key))
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .forEach(([key, val]) => {
        value[key] = val.split(SCRIPT_RUNNER_OR).sort() // sort to make sure the order is always the same
      })
  }
}

const findScriptRunnerDC = (funcs: Value[]): WalkOnFunc => (
  ({ value }): WALK_NEXT_STEP => {
    if (value === undefined) {
      return WALK_NEXT_STEP.SKIP
    }
    if (SCRIPT_RUNNER_DC_TYPES.includes(value.type) && value.configuration !== undefined) {
      funcs.forEach(func => func(value.configuration))
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  })

// Changes script runners strings that represent several values
// one option is strings that are split by '|||' to an array
// for example:
// FIELD_TRANSITION_OPTIONS = "FIELD_SKIP_PERMISSIONS|||FIELD_SKIP_VALIDATORS|||FIELD_SKIP_CONDITIONS"
// The other is mail lists that are split by spaces
const filter: FilterCreator = ({ client, config }) => ({
  name: 'scriptRunnerWorkflowListsFilter',
  onFetch: async (elements: Element[]) => {
    if (!config.fetch.enableScriptRunnerAddon || !client.isDataCenter) {
      return
    }
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .forEach(instance => {
        walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
          value: instance.value.transitions,
          func: findScriptRunnerDC([replaceOr, replaceMailLists, objectifyDirectionFields]) })
      })
  },
  preDeploy: async changes => {
    if (!config.fetch.enableScriptRunnerAddon || !client.isDataCenter) {
      return
    }
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .forEach(instance => {
        walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
          value: instance.value.transitions,
          func: findScriptRunnerDC([stringifyDirectionFields, returnOr, returnMailLists]) })
      })
  },
  onDeploy: async changes => {
    if (!config.fetch.enableScriptRunnerAddon || !client.isDataCenter) {
      return
    }
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .forEach(instance => {
        walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
          value: instance.value.transitions,
          func: findScriptRunnerDC([replaceOr, replaceMailLists, objectifyDirectionFields]) })
      })
  },
})

export default filter
