/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { createElementSelector } from '@salto-io/workspace'
import { CommandOrGroupDef, isCommand, CommandAction } from '../src/command_builder'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const expectElementSelector = (selector: string): any => (
  expect.arrayContaining([expect.objectContaining(
    _.pick(createElementSelector(selector), 'adapterSelector',
      'idTypeSelector', 'nameSelectorRegexes', 'origin', 'typeNameSelector')
  )])
)

export const findSubCommandByName = (
  subCommands: CommandOrGroupDef[],
  name: string,
): CommandOrGroupDef | undefined =>
  (subCommands.find(subCommand => subCommand.properties.name === name))

export const getSubCommandAction = <T>(
  subCommands: CommandOrGroupDef[],
  name: string,
): CommandAction<T> | undefined => {
  const command = findSubCommandByName(subCommands, name)
  if (command !== undefined && isCommand(command)) {
    return command.action
  }
  return undefined
}
