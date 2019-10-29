import _ from 'lodash'
// TODO: This import breaks the abstraction of CliOutput as it communicate directly with console
import * as inquirer from 'inquirer'
import {
  Type, ObjectType, ElemID, InstanceElement,
  isPrimitiveType, PrimitiveTypes,
} from 'adapter-api'
import { Plan, DetailedChange } from 'salto'
import {
  createApplyPlanOutput, formatDiscoverChangeForApproval,
} from './formatter'
import Prompts from './prompts'
import { CliOutput } from './types'

const getUserBooleanInput = async (prompt: string): Promise<boolean> => {
  const question = {
    name: 'userInput',
    message: prompt,
    type: 'confirm',
  }
  const answers = await inquirer.prompt(question)
  return answers.userInput
}

export const shouldApply = ({ stdout }: CliOutput) => async (actions: Plan): Promise<boolean> => {
  const planOutput = createApplyPlanOutput(actions)
  stdout.write(planOutput)
  if (_.isEmpty(actions)) {
    return false
  }
  const shouldExecute = await getUserBooleanInput(Prompts.SHOULDEXECUTREPLAN)
  if (shouldExecute) {
    stdout.write(Prompts.STARTAPPLYEXEC)
  } else {
    stdout.write(Prompts.CANCELAPPLY)
  }
  return shouldExecute
}

export const getApprovedChanges = async (
  changes: ReadonlyArray<DetailedChange>,
): Promise<ReadonlyArray<DetailedChange>> => {
  const shouldApplyAll = (answers: inquirer.Answers): boolean => (
    _.values(answers).some(answer => answer === 'all')
  )

  const questions = changes.map((change, idx): inquirer.Question => ({
    type: 'expand',
    choices: [
      { key: 'y', value: 'yes' },
      { key: 'n', value: 'no' },
      { key: 'a', value: 'all' },
    ],
    default: 0,
    name: idx.toString(),
    message: formatDiscoverChangeForApproval(change, idx, changes.length),
    when: answers => !shouldApplyAll(answers),
  }))

  const answers = await inquirer.prompt(questions)
  if (shouldApplyAll(answers)) {
    return changes
  }
  return changes.filter((_change, idx) => answers[idx.toString()] === 'yes')
}

const inputTypePasswordFields = ['token', 'password']

const isPasswordInputType = (fieldName: string): boolean =>
  inputTypePasswordFields.includes(fieldName)

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
      name: fieldName,
      message: `Enter ${fieldName}:`,
    }))
  const values = await inquirer.prompt(questions)
  const elemID = new ElemID(configType.elemID.adapter, ElemID.CONFIG_INSTANCE_NAME)
  return new InstanceElement(elemID, configType, values)
}
