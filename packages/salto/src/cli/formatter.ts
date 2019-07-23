import _ from 'lodash'
import chalk from 'chalk'
import wu from 'wu'
import {
  isType, Plan, PlanAction, Element,
} from 'adapter-api'

import Prompts from './prompts'
import { FoundSearchResult, SearchResult } from '../core/search'


export const print = (txt: string): void => {
  // eslint-disable-next-line no-console
  console.log(txt)
}

export const printError = (txt: string): void => {
  // eslint-disable-next-line no-console
  console.error(chalk.red(txt))
}

export const header = (txt: string): string => chalk.bold(txt)

export const subHeader = (txt: string): string => chalk.grey(txt)

export const body = (txt: string): string => chalk.reset(txt)

export const warn = (txt: string): string => chalk.red(txt)

export const emptyLine = (): string => ''

export const seperator = (): string => `\n${'-'.repeat(78)}\n`

const createCountPlanActionTypesOutput = (plan: Plan): string => {
  const counter = _.countBy(wu(plan).toArray(), 'action')
  return (
    `${chalk.bold('Plan: ')}${counter.add || 0} to add`
    + `, ${counter.modify || 0} to change`
    + `, ${counter.remove || 0} to remove.`
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeValuePrint = (value: any): string => {
  if (typeof value === 'string') {
    return `"${value}"`
  }
  if (typeof value === 'undefined') {
    return 'undefined'
  }
  if (Array.isArray(value)) {
    return `[${value.map(normalizeValuePrint)}]`
  }
  return JSON.stringify(value)
}

const createdActionStepValue = (step: PlanAction): string => {
  if (step.action === 'modify') {
    return (
      `${normalizeValuePrint(step.data.before)}`
      + ` => ${normalizeValuePrint(step.data.after)}`
    )
  }
  if (step.action === 'add') {
    return `${normalizeValuePrint(step.data.after)}`
  }
  return `${normalizeValuePrint(step.data.before)}`
}

const createPlanActionName = (step: PlanAction): string => (step.data.before
  ? step.data.before.elemID.getFullName()
  : (step.data.after as Element).elemID.getFullName())

const createPlanStepTitle = (
  step: PlanAction,
  printModifiers?: boolean,
): string => {
  const modifier = printModifiers ? Prompts.MODIFIERS[step.action] : ' '
  const stepDesc = `${modifier} ${createPlanActionName(step)} ${step.action}`
  const stepValue = createdActionStepValue(step)
  return step.subChanges ? stepDesc : [stepDesc, stepValue].join(':')
}

const createPlanStepOutput = (
  step: PlanAction,
  printModifiers: boolean,
  identLevel: number = 1,
): string => {
  const stepTitle = createPlanStepTitle(step, printModifiers)
  const stepChildren = step.subChanges
    ? wu(step.subChanges).map((subChange: PlanAction): string => {
      const printChildModifiers = subChange.action === 'modify'
      return createPlanStepOutput(subChange, printChildModifiers, identLevel + 1)
    }).toArray()
    : []

  const allLines = [stepTitle].concat(stepChildren)

  const prefix = '  '.repeat(identLevel)
  return allLines
    .map(line => prefix + line)
    .join('\n')
}

const createPlanStepsOutput = (
  plan: Plan
): string => wu(plan).map(step => createPlanStepOutput(step, true))
  .toArray().join('\n\n')

const notifyDescribeNoMatch = (): string => warn(Prompts.DESCRIBE_NOT_FOUND)

const notifyDescribeNearMatch = (result: FoundSearchResult): string => [
  header(Prompts.DESCRIBE_NEAR_MATCH),
  emptyLine(),
  subHeader(`\t${Prompts.DID_YOU_MEAN} ${chalk.bold(result.key)}?`),
  emptyLine(),
].join('\n')

const formatElementDescription = (element: Element): string => {
  if (isType(element) && element.annotationsValues.description) {
    return [emptyLine(), element.annotationsValues.description].join('\n')
  }
  return emptyLine()
}

const getElapsedTime = (start: Date): number => Math.ceil(
  (new Date().getTime() - start.getTime()) / 1000,
)

export const createPlanOutput = (plan: Plan): string => {
  const actionCount = createCountPlanActionTypesOutput(plan)
  const planSteps = createPlanStepsOutput(plan)
  return [
    header(Prompts.STARTPLAN),
    subHeader(Prompts.EXPLAINPLAN),
    seperator(),
    subHeader(Prompts.EXPLAINPLANRESULT),
    emptyLine(),
    planSteps,
    emptyLine(),
    actionCount,
  ].join('\n')
}

export const formatSearchResults = (
  result: SearchResult
): string => {
  if (!(result && result.element)) {
    return notifyDescribeNoMatch()
  }
  if (result.isGuess) {
    return notifyDescribeNearMatch(result)
  }
  const { element } = result
  const elementName = element.elemID.getFullName()
  const title = header(`=== ${elementName} ===`)
  const description = subHeader(formatElementDescription(element))
  // TODO - Change to dump HCL
  const elementHCL = body(JSON.stringify(element, null, 2))
  return [title, description, elementHCL].join('\n')
}

export const createActionDoneOutput = (
  currentAction: PlanAction,
  currentActionStartTime: Date
): string => {
  const elapsed = getElapsedTime(currentActionStartTime)
  return `${createPlanActionName(currentAction)}: `
        + `${Prompts.ENDACTION[currentAction.action]} `
        + `completed after ${elapsed}s`
}

export const createActionStartOutput = (action: PlanAction): string => {
  const output = [
    emptyLine(),
    body(
      `${createPlanActionName(action)}: ${Prompts.STARTACTION[action.action]}...`
    ),
  ]
  return output.join('\n')
}

export const createActionInProgressOutput = (action: PlanAction, start: Date): string => {
  const elapsed = getElapsedTime(start)
  const elapsedRound = Math.ceil((elapsed - elapsed) % 5)
  return body(`${createPlanActionName(action)}: Still ${
    Prompts.STARTACTION[action.action]
  }... (${elapsedRound}s elapsed)`)
}
