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
// TODO: This import breaks the abstraction of CliOutput as it communicate directly with console
import * as inquirer from 'inquirer'
import {
  TypeElement, ObjectType, ElemID, InstanceElement,
  isPrimitiveType, PrimitiveTypes,
} from '@salto-io/adapter-api'
import { Plan, FetchChange, Workspace, StateRecency } from '@salto-io/core'
import {
  formatExecutionPlan, formatFetchChangeForApproval, deployPhaseHeader, cancelDeployOutput,
  formatShouldContinueWithWarning, formatCancelCommand, formatCredentialsHeader,
  formatConfigFieldInput, formatShouldAbortWithValidationError, formatShouldUpdateConfig,
  formatShouldCancelWithOldState, formatShouldCancelWithNonexistentState, formatWordsSeries,
} from './formatter'
import Prompts from './prompts'
import { CliOutput, WriteStream } from './types'

const getUserBooleanInput = async (prompt: string): Promise<boolean> => {
  const question = {
    name: 'userInput',
    message: prompt,
    type: 'confirm',
  }
  const answers = await inquirer.prompt(question)
  return answers.userInput
}

export const shouldDeploy = (stdout: WriteStream, workspace: Workspace) =>
  async (actions: Plan): Promise<boolean> => {
    const planWorkspaceErrors = await Promise.all(
      actions.changeErrors.map(ce => workspace.transformToWorkspaceError(ce))
    )
    stdout.write(await formatExecutionPlan(actions, planWorkspaceErrors))
    if (_.isEmpty(actions)) {
      return false
    }
    const shouldExecute = await getUserBooleanInput(Prompts.SHOULD_EXECUTE_PLAN)
    if (shouldExecute) {
      stdout.write(deployPhaseHeader)
    } else {
      stdout.write(cancelDeployOutput)
    }
    return shouldExecute
  }

export const shouldCancelInCaseOfNoRecentState = async (recency: StateRecency,
  { stdout }: CliOutput): Promise<boolean> => {
  const prompt = recency.status === 'Nonexistent'
    ? formatShouldCancelWithNonexistentState : formatShouldCancelWithOldState
  const shouldCancel = await getUserBooleanInput(prompt)
  if (shouldCancel) {
    stdout.write(formatCancelCommand)
  }
  return shouldCancel
}

export const shouldContinueInCaseOfWarnings = async (numWarnings: number,
  { stdout }: CliOutput): Promise<boolean> => {
  const shouldContinue = await getUserBooleanInput(formatShouldContinueWithWarning(numWarnings))
  if (!shouldContinue) {
    stdout.write(formatCancelCommand)
  }
  return shouldContinue
}

export const shouldAbortWorkspaceInCaseOfValidationError = async (numErrors: number):
Promise<boolean> => getUserBooleanInput(formatShouldAbortWithValidationError(numErrors))

export const shouldUpdateConfig = async (adapterName: string, formattedChanges: string):
Promise<boolean> => getUserBooleanInput(formatShouldUpdateConfig(adapterName, formattedChanges))

export const getApprovedChanges = async (
  changes: ReadonlyArray<FetchChange>,
  interactive: boolean,
): Promise<ReadonlyArray<FetchChange>> => {
  const shouldApproveAll = (answers: inquirer.Answers): boolean => (
    _.values(answers).some(answer => answer === 'all')
  )
  const isConflict = (change: FetchChange): boolean => change.pendingChange !== undefined
  const shouldAskForApproval = (change: FetchChange): boolean => isConflict(change) || interactive

  const [askForApproval, autoApproved] = _.partition(changes, shouldAskForApproval)
  if (_.isEmpty(askForApproval)) {
    return autoApproved
  }

  const questions = askForApproval.map((change, idx): inquirer.Question => ({
    type: 'expand',
    choices: [
      { key: 'y', value: 'yes' },
      { key: 'n', value: 'no' },
      { key: 'a', value: 'all' },
    ],
    default: 0,
    name: idx.toString(),
    message: formatFetchChangeForApproval(change, idx, askForApproval.length),
    when: answers => !shouldApproveAll(answers),
  }))

  const answers = await inquirer.prompt(questions)
  if (shouldApproveAll(answers)) {
    return changes
  }
  return autoApproved.concat(askForApproval
    .filter((_c, idx) => (answers[idx.toString()] !== 'no')))
}

const isPasswordInputType = (fieldName: string): boolean =>
  ['token', 'password'].includes(fieldName)

export const getFieldInputType = (fieldType: TypeElement, fieldName: string): string => {
  if (!isPrimitiveType(fieldType)) {
    throw new Error('Only primitive configuration values are supported')
  }

  if (fieldType.primitive === PrimitiveTypes.STRING) {
    if (isPasswordInputType(fieldName)) {
      return 'password'
    }

    return 'input'
  }
  if (fieldType.primitive === PrimitiveTypes.NUMBER) {
    return 'number'
  }
  return 'confirm'
}

export const getCredentialsFromUser = async (credentialsType: ObjectType):
Promise<InstanceElement> => {
  const questions = Object.keys(credentialsType.fields).map(fieldName =>
    ({
      type: getFieldInputType(credentialsType.fields[fieldName].type, fieldName),
      mask: '*',
      name: fieldName,
      message: formatConfigFieldInput(
        fieldName, credentialsType.fields[fieldName].annotations.message,
      ),
    }))
  const values = await inquirer.prompt(questions)
  return new InstanceElement(ElemID.CONFIG_NAME, credentialsType, values)
}

export const getConfigWithHeader = async (output: WriteStream, credentialsType: ObjectType):
  Promise<InstanceElement> => {
  output.write(formatCredentialsHeader(credentialsType.elemID.adapter))
  return getCredentialsFromUser(credentialsType)
}

export const getEnvName = async (currentName = 'default'): Promise<string> => {
  const questions = [{
    type: 'input',
    mask: '*',
    message: `Enter a new name for the ${currentName} environment`,
    name: currentName,
    default: currentName,
  }]
  return (await inquirer.prompt(questions))[currentName]
}

export const cliApproveIsolatedMode = async (newServices: string[]): Promise<boolean> => (
  getUserBooleanInput(Prompts.APPROVE_ISOLATED_RECOMMENDATION(formatWordsSeries(newServices)))
)
