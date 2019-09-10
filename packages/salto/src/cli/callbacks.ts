import _ from 'lodash'
// TODO: This import breaks the abstaraction of CliOutput as it communicate directly with console
import * as inquirer from 'inquirer'
import {
  Type, ObjectType, ElemID, InstanceElement,
  isPrimitiveType, PrimitiveTypes,
} from 'adapter-api'
import { Plan } from '../core/plan'
import {
  createPlanOutput, header, subHeader,
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
  const planOutput = [
    header(Prompts.STARTAPPLY),
    subHeader(Prompts.EXPLAINAPPLY),
    createPlanOutput(actions),
  ].join('\n')
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

export const getFieldInputType = (field: Type): string => {
  if (!isPrimitiveType(field)) {
    throw new Error('Only primitive configuration values are supported')
  }
  if (field.primitive === PrimitiveTypes.STRING) {
    return 'input'
  }
  if (field.primitive === PrimitiveTypes.NUMBER) {
    return 'number'
  }
  return 'confirm'
}

export const getConfigFromUser = async (configType: ObjectType): Promise<InstanceElement> => {
  const questions = Object.keys(configType.fields).map(fieldName =>
    ({
      type: getFieldInputType(configType.fields[fieldName].type),
      name: fieldName,
      message: `Enter ${fieldName} value:`,
    }))
  const values = await inquirer.prompt(questions)
  const elemID = new ElemID(configType.elemID.adapter, ElemID.CONFIG_INSTANCE_NAME)
  return new InstanceElement(elemID, configType, values)
}
