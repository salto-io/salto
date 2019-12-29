import _ from 'lodash'
// TODO: This import breaks the abstraction of CliOutput as it communicate directly with console
import * as inquirer from 'inquirer'
import {
  Type, ObjectType, ElemID, InstanceElement,
  isPrimitiveType, PrimitiveTypes,
} from 'adapter-api'
import { Plan, FetchChange, Workspace } from 'salto'
import {
  formatExecutionPlan, formatFetchChangeForApproval, deployPhaseHeader, cancelDeployOutput,
  formatShouldContinueWithWarning, formatCancelCommand, formatConfigHeader,
  formatConfigFieldInput,
} from './formatter'
import Prompts from './prompts'
import { CliOutput, WriteStream, Spinner } from './types'

const getUserBooleanInput = async (prompt: string): Promise<boolean> => {
  const question = {
    name: 'userInput',
    message: prompt,
    type: 'confirm',
  }
  const answers = await inquirer.prompt(question)
  return answers.userInput
}

export const shouldDeploy = (stdout: WriteStream, spinner: Spinner, workspace: Workspace) =>
  async (actions: Plan): Promise<boolean> => {
    spinner.succeed(Prompts.PREVIEW_FINISHED)
    const planWorkspaceErrors = await Promise.all(
      actions.changeErrors.map(ce => workspace.transformToWorkspaceError(ce))
    )
    stdout.write(await formatExecutionPlan(actions, planWorkspaceErrors))
    if (_.isEmpty(actions)) {
      return false
    }
    const shouldExecute = await getUserBooleanInput(Prompts.SHOULDEXECUTEPLAN)
    if (shouldExecute) {
      stdout.write(deployPhaseHeader)
    } else {
      stdout.write(cancelDeployOutput)
    }
    return shouldExecute
  }

export const shouldContinueInCaseOfWarnings = async (numWarnings: number,
  { stdout }: CliOutput): Promise<boolean> => {
  const shouldContinue = await getUserBooleanInput(formatShouldContinueWithWarning(numWarnings))
  if (!shouldContinue) {
    stdout.write(formatCancelCommand)
  }
  return shouldContinue
}

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

export const getFieldInputType = (fieldType: Type, fieldName: string): string => {
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

export const getConfigFromUser = async (configType: ObjectType): Promise<InstanceElement> => {
  const questions = Object.keys(configType.fields).map(fieldName =>
    ({
      type: getFieldInputType(configType.fields[fieldName].type, fieldName),
      mask: '*',
      name: fieldName,
      message: formatConfigFieldInput(fieldName),
    }))
  const values = await inquirer.prompt(questions)
  return new InstanceElement(ElemID.CONFIG_NAME, configType, values)
}

export const getConfigWithHeader = async (output: WriteStream, configType: ObjectType):
  Promise<InstanceElement> => {
  output.write(formatConfigHeader(configType.elemID.adapter))
  return getConfigFromUser(configType)
}
