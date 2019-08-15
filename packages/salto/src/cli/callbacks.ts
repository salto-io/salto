import _ from 'lodash'
import * as inquirer from 'inquirer'
import {
  Type, ObjectType, ElemID, InstanceElement,
  isPrimitiveType, PrimitiveTypes,
} from 'adapter-api'
import { Plan } from '../core/plan'
import {
  createPlanOutput, header, subHeader, print,
} from './formatter'
import Prompts from './prompts'

const getUserBooleanInput = async (prompt: string): Promise<boolean> => {
  const question = {
    name: 'userInput',
    message: prompt,
    type: 'confirm',
  }
  const answers = await inquirer.prompt(question)
  return answers.userInput
}

export const shouldApply = async (actions: Plan): Promise<boolean> => {
  const planOutput = [
    header(Prompts.STARTAPPLY),
    subHeader(Prompts.EXPLAINAPPLY),
    createPlanOutput(actions),
  ].join('\n')
  print(planOutput)
  if (_.isEmpty(actions)) {
    return false
  }
  const shouldExecute = await getUserBooleanInput(Prompts.SHOULDEXECUTREPLAN)
  if (shouldExecute) {
    print(header(Prompts.STARTAPPLYEXEC))
  } else {
    print(header(Prompts.CANCELAPPLY))
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
