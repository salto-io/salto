import _ from 'lodash'
import chalk from 'chalk'
import wu from 'wu'
import {
  isType, Element, Type, isInstanceElement, Values, Change, Value, getChangeElement, ElemID,
  isObjectType, isField, isPrimitiveType, Field, PrimitiveTypes,
} from 'adapter-api'
import {
  Plan, PlanItem, FoundSearchResult, SearchResult, DetailedChange,
  WorkspaceError, SourceFragment, DiscoverChange,
} from 'salto'
import Prompts from './prompts'


export const header = (txt: string): string => chalk.bold(txt)

export const subHeader = (txt: string): string => chalk.grey(txt)

export const body = (txt: string): string => chalk.reset(txt)

export const warn = (txt: string): string => chalk.red(txt)

export const emptyLine = (): string => ''

export const seperator = (): string => `\n${'-'.repeat(78)}\n`

const fullName = (change: Change): string => getChangeElement(change).elemID.getFullName()

const planItemName = (step: PlanItem): string => fullName(step.parent())

const indent = (text: string, level: number): string => {
  const indentText = _.repeat('  ', level)
  return text.split('\n').map(line => `${indentText}${line}`).join('\n')
}

const formatValue = (value: Element | Value): string => {
  const formatAnnotations = (annotations: Values): string =>
    (_.isEmpty(annotations) ? '' : formatValue(annotations))
  const formatAnnotationTypes = (types: Record<string, Type>): string =>
    (_.isEmpty(types) ? '' : indent(`\nannotations:${formatValue(types)}`, 2))
  const formatFields = (fields: Record<string, Field>): string =>
    (_.isEmpty(fields) ? '' : indent(`\nfields:${formatValue(fields)}`, 2))

  if (isInstanceElement(value)) {
    return formatValue(value.value)
  }
  if (isObjectType(value)) {
    return [
      formatAnnotations(value.annotations),
      formatFields(value.fields),
      formatAnnotationTypes(value.annotationTypes),
    ].join('')
  }
  if (isPrimitiveType(value)) {
    const primitiveTypenames = {
      [PrimitiveTypes.STRING]: 'string',
      [PrimitiveTypes.NUMBER]: 'number',
      [PrimitiveTypes.BOOLEAN]: 'boolean',
    }
    return [
      indent(`\nTYPE: ${primitiveTypenames[value.primitive]}`, 2),
      formatAnnotations(value.annotations),
      formatAnnotationTypes(value.annotationTypes),
    ].join('')
  }
  if (isField(value)) {
    return [
      indent(`\nTYPE: ${value.type.elemID.getFullName()}`, 2),
      formatAnnotations(value.annotations),
    ].join('')
  }
  if (_.isArray(value)) {
    return `[${value.map(formatValue)}]`
  }
  if (_.isPlainObject(value)) {
    const formattedKeys = _.entries(value)
      .map(([k, v]) => `${k}: ${formatValue(v)}`)
      .join('\n')
    return `\n${indent(formattedKeys, 2)}`
  }
  return JSON.stringify(value)
}

const isDummyChange = (change: DetailedChange): boolean => (
  change.action === 'modify' && change.data.before === undefined && change.data.after === undefined
)

const formatChangeData = (change: DetailedChange): string => {
  if (isDummyChange(change)) {
    // This is a dummy change created just so we print a "title" for a group of changes
    return ''
  }
  if (change.action === 'modify') {
    const { before, after } = change.data
    return `${formatValue(before)} => ${formatValue(after)}`
  }
  return formatValue(_.get(change.data, 'before', _.get(change.data, 'after')))
}

export const formatChange = (change: DetailedChange): string => {
  const modifierType = isDummyChange(change) ? 'eq' : change.action
  const modifier = Prompts.MODIFIERS[modifierType]
  const id = change.id.nameParts.length === 1
    ? change.id.getFullName()
    : change.id.nameParts.slice(-1)[0]
  return indent(`${modifier} ${id}: ${formatChangeData(change)}`, change.id.nameParts.length)
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

const formatDetailedChanges = (changeGroups: Iterable<Iterable<DetailedChange>>): string => {
  const addMissingEmptyChanges = (changes: DetailedChange[]): DetailedChange[] => {
    const emptyChange = (id: ElemID): DetailedChange => ({
      action: 'modify',
      data: { before: undefined, after: undefined },
      id,
    })

    const createMissingChanges = (id: ElemID, existingIds: Set<string>): DetailedChange[] => {
      const parentId = id.createParentID()
      if (parentId.nameParts.length === 0 || existingIds.has(parentId.getFullName())) {
        return []
      }
      existingIds.add(parentId.getFullName())
      return [emptyChange(parentId), ...createMissingChanges(parentId, existingIds)]
    }

    const existingIds = new Set(changes.map(c => c.id.getFullName()))
    const missingChanges = _(changes)
      .map(change => createMissingChanges(change.id, existingIds))
      .flatten()
      .value()
    return [...changes, ...missingChanges]
  }

  return wu(changeGroups)
    .map(changes => [...changes])
    // Fill in all missing "levels" of each change group
    .map(addMissingEmptyChanges)
    // Sort changes so they show up nested correctly
    .map(changes => _.sortBy(changes, change => change.id.getFullName()))
    // Format changes
    .map(changes => changes.map(formatChange).join('\n'))
    .toArray()
    .join('\n\n')
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
  const planSteps = formatDetailedChanges(
    wu(plan.itemsByEvalOrder()).map(item => item.detailedChanges())
  )
  return [
    header(Prompts.STARTPLAN),
    subHeader(Prompts.EXPLAINPLAN),
    seperator(),
    subHeader(Prompts.EXPLAINPLANRESULT),
    emptyLine(),
    planSteps,
    emptyLine(),
    actionCount,
    subHeader(Prompts.PLANDISCLAIMER),
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
  const elementHcl = body(JSON.stringify(element, null, 2))
  return [title, description, elementHcl].join('\n')
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
    emptyLine(),
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

export const formatDiscoverChangeForApproval = (
  change: DiscoverChange,
  idx: number,
  totalChanges: number
): string => {
  const formattedChange = formatDetailedChanges([[change.serviceChange]])
  const formattedConflict = change.pendingChange === undefined ? [] : [
    header(Prompts.DISCOVER_CONFLICTING_CHANGE),
    body(formatDetailedChanges([[change.pendingChange]])),
  ]
  return [
    header(Prompts.DISCOVER_CHANGE_HEADER(idx + 1, totalChanges)),
    body(formattedChange),
    ...formattedConflict,
    header(Prompts.DISCOVER_SHOULD_APPROVE_CHANGE),
  ].join('\n')
}

export const formatChangesSummary = (changes: number, approved: number): string => {
  if (changes === 0) {
    return Prompts.DISCOVER_NO_CHANGES
  }
  if (approved === 0) {
    return Prompts.DISCOVER_NOTHING_TO_UPDATE
  }
  return Prompts.DISCOVER_CHANGES_TO_APPLY(approved)
}

/**
  * Format workspace errors
  */

const TAB = '  '
const fomratSourceFragment = (sf: Readonly<SourceFragment>): string =>
  `${chalk.underline(sf.sourceRange.filename)}(${chalk.cyan(`${sf.sourceRange.start.line}`)}`
  + `:${chalk.cyan(`${sf.sourceRange.start.col}`)})\n${TAB}${chalk.blueBright(sf.fragment.split('\n').join(`\n${TAB}`))}\n`
const fomratSourceFragments = (sourceFragments: ReadonlyArray<SourceFragment>): string =>
  (sourceFragments.length > 0
    ? ` on ${sourceFragments.map(fomratSourceFragment).join('\n and ')}`
    : '')

const formatWorkspaceError = (we: Readonly<WorkspaceError>): string =>
  `${chalk.red(chalk.bold('Error:'))} ${chalk.bold(we.error)}\n${fomratSourceFragments(we.sourceFragments)}`

export const formatWorkspaceErrors = (workspaceErrors: ReadonlyArray<WorkspaceError>): string =>
  `${Prompts.WORKSPACE_LOAD_FAILED}\n${workspaceErrors.map(formatWorkspaceError).join('\n\n')}\n`
