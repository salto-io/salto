import _ from 'lodash'
import chalk from 'chalk'
import wu from 'wu'
import {
  isType, Plan, PlanAction, Element,
} from 'adapter-api'

import Prompts from './prompts'
import { FoundSearchResult, SearchResult } from '../core/search'
import { formatAction, ActionLineFormat } from './action_filler'

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
  const counter = _.countBy(plan, 'action')
  return (
    `${chalk.bold('Plan: ')}${counter.add || 0} to add`
    + `, ${counter.modify || 0} to change`
    + `, ${counter.remove || 0} to remove.`
  )
}

const createPlanActionName = (step: PlanAction): string => (step.data.before
  ? step.data.before.elemID.getFullName()
  : (step.data.after as Element).elemID.getFullName())

const createPlanStepTitle = (
  step: ActionLineFormat,
  printModifiers?: boolean,
): string => {
  const modifier = printModifiers ? step.actionModifier : ' '
  const stepDesc = `${modifier} ${step.name}`
  return [stepDesc, step.value].filter(n => n).join(': ')
}

const createPlanStepOutput = (
  formatedAction: ActionLineFormat,
  printModifiers: boolean,
  identLevel: number = 1,
): string => {
  const lineTitle = createPlanStepTitle(formatedAction, printModifiers)
  const lineChildren = formatedAction.subLines
    ? wu(formatedAction.subLines).map((subLine): string => {
      const printChildModifiers = subLine.actionModifier !== formatedAction.actionModifier
      return createPlanStepOutput(subLine, printChildModifiers, identLevel + 1)
    }).toArray()
    : []

  const allLines = [lineTitle].concat(lineChildren)

  const prefix = '  '.repeat(identLevel)
  return allLines
    .map(line => prefix + line)
    .join('\n')
}

const createPlanStepsOutput = (
  plan: Plan
): string => wu(plan).map(step => createPlanStepOutput(formatAction(step), true))
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
  if (_.isEmpty(plan)) {
    return [
      emptyLine(),
      Prompts.EMPTY_PLAN,
      emptyLine(),
    ].join('\n')
  }
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
