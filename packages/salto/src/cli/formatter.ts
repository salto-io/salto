import _ from 'lodash'
import chalk from 'chalk'
import wu from 'wu'
import {
  isType, Element, Type, isInstanceElement, isEqualElements,
  Values, Change, InstanceElement, Value, getChangeElement,
} from 'adapter-api'
import { Plan, PlanItem } from '../core/plan'
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

interface PlanItemDescription {
  name: string
  actionModifier: string
  subLines: PlanItemDescription[]
  value?: string
}

const exists = (value: Value): boolean =>
  (_.isObject(value) ? !_.isEmpty(value) : !_.isUndefined(value))

const fullName = (change: Change): string => getChangeElement(change).elemID.getFullName()

const planItemName = (step: PlanItem): string => fullName(step.parent())

const createStepValue = (before?: Value, after?: Value): string|undefined => {
  const normalizeValuePrint = (value: Value): string => {
    if (typeof value === 'string') {
      return `"${value}"`
    }
    if (Array.isArray(value)) {
      return `[${value.map(normalizeValuePrint)}]`
    }
    return JSON.stringify(value)
  }

  if (exists(before) && exists(after)) {
    return `${normalizeValuePrint(before)} => ${normalizeValuePrint(after)}`
  }
  return normalizeValuePrint(before || after)
}

const getModifier = (before: Value, after: Value): string => {
  if (isEqualElements(before, after) || _.isEqual(before, after)) {
    return ' '
  }
  if (exists(before) && exists(after)) {
    return Prompts.MODIFIERS.modify
  }
  if (!exists(before) && exists(after)) {
    return Prompts.MODIFIERS.add
  }
  return Prompts.MODIFIERS.remove
}

const filterEQ = (
  actions: PlanItemDescription[]
): PlanItemDescription[] => actions.filter(a => a.actionModifier !== ' ')

const createValuesChanges = (before: Values, after: Values): PlanItemDescription[] =>
  _.union(Object.keys(before), Object.keys(after)).map(name => {
    const subLines = (_.isPlainObject(before[name]) || _.isPlainObject(after[name]))
      ? createValuesChanges(before[name] || {}, after[name] || {}) : []
    return {
      name,
      actionModifier: getModifier(before[name], after[name]),
      subLines: filterEQ(subLines),
      value: _.isEmpty(subLines) ? createStepValue(before[name], after[name]) : undefined,
    }
  })

const createAnnotationsChanges = (
  before: Record<string, Type>,
  after: Record<string, Type>
): PlanItemDescription[] => _.union(Object.keys(before), Object.keys(after)).map(name => {
  const subLines = createValuesChanges(
    (before[name]) ? before[name].annotations : {},
    (after[name]) ? after[name].annotations : {}
  )
  return {
    name,
    actionModifier: getModifier(before[name], after[name]),
    subLines: filterEQ(subLines),
  }
})

const formatObjectTypePlanItem = (item: PlanItem): PlanItemDescription => {
  const isRoot = (change: Change): boolean => (fullName(change) === item.groupKey)

  const typeChange = wu(item.items.values()).find(isRoot)
  let subLines: PlanItemDescription[] = []
  if (typeChange && typeChange.action === 'modify') {
    // Collect element level changes
    const { before, after } = typeChange.data
    subLines = [
      ...createValuesChanges(
        _.get(before, 'annotations', {}),
        _.get(after, 'annotations', {}),
      ),
      ...createAnnotationsChanges(
        _.get(before, 'annotationsDescriptor', {}),
        _.get(after, 'annotationsDescriptor', {}),
      ),
    ]
  }

  subLines = [...subLines, ...wu(item.items.values()).reject(isRoot).map(change => {
    // Collect field level change
    const beforeValues = change.action === 'add' ? {} : change.data.before.annotations
    const afterValues = change.action === 'remove' ? {} : change.data.after.annotations
    const sub = createValuesChanges(beforeValues, afterValues)
    return {
      name: fullName(change),
      actionModifier: Prompts.MODIFIERS[change.action],
      subLines: filterEQ(sub),
    }
  }).toArray()]

  return {
    name: item.groupKey,
    actionModifier: Prompts.MODIFIERS[item.parent().action],
    subLines: filterEQ(subLines),
  }
}

const formatInstanceElementPlanItem = (item: PlanItem): PlanItemDescription => {
  const parent = item.parent() as Change<InstanceElement>
  const beforeValues = parent.action === 'add' ? {} : parent.data.before.value
  const afterValues = parent.action === 'remove' ? {} : parent.data.after.value
  const subLines = createValuesChanges(beforeValues, afterValues)
  return {
    name: planItemName(item),
    actionModifier: getModifier(_.get(parent.data, 'before'), _.get(parent.data, 'after')),
    subLines: filterEQ(subLines),
  }
}

export const formatPlanItem = (item: PlanItem): PlanItemDescription => {
  const parent = item.parent()
  const before = parent.action === 'add' ? {} : parent.data.before
  const after = parent.action === 'remove' ? {} : parent.data.after
  if (isInstanceElement(before || after)) {
    return formatInstanceElementPlanItem(item)
  }
  return formatObjectTypePlanItem(item)
}

const createCountPlanItemTypesOutput = (plan: Plan): string => {
  const items = wu(plan.itemsByEvalOrder())
    .map(item => ({ action: item.parent().action, name: planItemName(item) }))
    .unique().toArray()
  const counter = _.countBy(items, 'action')
  return (
    `${chalk.bold('Plan: ')}${counter.add || 0} to add`
    + `, ${counter.modify || 0} to change`
    + `, ${counter.remove || 0} to remove.`
  )
}

const createPlanStepTitle = (
  step: PlanItemDescription,
  printModifiers?: boolean,
): string => {
  const modifier = printModifiers ? step.actionModifier : ' '
  const stepDesc = `${modifier} ${step.name}`
  return [stepDesc, step.value].filter(n => n).join(': ')
}

const createPlanStepsOutput = (plan: Plan): string => {
  const createPlanStepOutput = (
    formatedAction: PlanItemDescription,
    printModifiers: boolean,
    identLevel = 1,
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

  return wu(plan.itemsByEvalOrder())
    .map(step => createPlanStepOutput(formatPlanItem(step), true))
    .toArray().join('\n\n')
}

const formatElementDescription = (element: Element): string => {
  if (isType(element) && element.annotations.description) {
    return [emptyLine(), element.annotations.description].join('\n')
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
  const actionCount = createCountPlanItemTypesOutput(plan)
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

export const formatSearchResults = (result: SearchResult): string => {
  const notifyDescribeNoMatch = (): string => warn(Prompts.DESCRIBE_NOT_FOUND)
  const notifyDescribeNearMatch = (searchResult: FoundSearchResult): string => [
    header(Prompts.DESCRIBE_NEAR_MATCH),
    emptyLine(),
    subHeader(`\t${Prompts.DID_YOU_MEAN} ${chalk.bold(searchResult.key)}?`),
    emptyLine(),
  ].join('\n')

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

export const createItemDoneOutput = (item: PlanItem, startTime: Date): string => {
  const elapsed = getElapsedTime(startTime)
  return `${planItemName(item)}: `
        + `${Prompts.ENDACTION[item.parent().action]} `
        + `completed after ${elapsed}s`
}

export const createActionStartOutput = (action: PlanItem): string => {
  const output = [
    emptyLine(),
    body(
      `${planItemName(action)}: ${Prompts.STARTACTION[action.parent().action]}...`
    ),
  ]
  return output.join('\n')
}

export const createActionInProgressOutput = (action: PlanItem, start: Date): string => {
  const elapsed = getElapsedTime(start)
  const elapsedRound = Math.ceil((elapsed - elapsed) % 5)
  return body(`${planItemName(action)}: Still ${
    Prompts.STARTACTION[action.parent().action]
  }... (${elapsedRound}s elapsed)`)
}
