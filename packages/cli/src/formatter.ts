import _ from 'lodash'
import chalk from 'chalk'
import wu from 'wu'
import {
  isType, Element, Type, isInstanceElement, Values, Change, Value, getChangeElement, ElemID,
  isObjectType, isField, isPrimitiveType, Field, PrimitiveTypes, ActionName,
} from 'adapter-api'
import {
  Plan, PlanItem, FoundSearchResult, SearchResult, DetailedChange,
  WorkspaceError, SourceFragment, FetchChange, MergeError, WorkspaceErrorSeverity,
} from 'salto'
import Prompts from './prompts'


export const header = (txt: string): string => chalk.bold(txt)

export const subHeader = (txt: string): string => chalk.grey(txt)

export const body = (txt: string): string => chalk.reset(txt)

export const warn = (txt: string): string => chalk.red(txt)

export const success = (txt: string): string => chalk.green(txt)

export const error = (txt: string): string => chalk.red.bold(txt)

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
  if (isDummyChange(change) || change.action === 'remove') {
    // No need to format details about dummy changes and removals
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
  const id = change.id.nestingLevel === 1
    ? change.id.getFullName()
    : change.id.name
  return indent(`${modifier} ${id}: ${formatChangeData(change)}`, change.id.nestingLevel)
}

const formatCountPlanItemTypes = (plan: Plan): string => {
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

    const formatMissingChanges = (id: ElemID, existingIds: Set<string>): DetailedChange[] => {
      const parentId = id.createParentID()
      if (parentId.isConfig() || existingIds.has(parentId.getFullName())) {
        return []
      }
      existingIds.add(parentId.getFullName())
      return [emptyChange(parentId), ...formatMissingChanges(parentId, existingIds)]
    }

    const existingIds = new Set(changes.map(c => c.id.getFullName()))
    const missingChanges = _(changes)
      .map(change => formatMissingChanges(change.id, existingIds))
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

const formatExecution = (plan: Plan): string[] => {
  if (_.isEmpty(plan)) {
    return [
      emptyLine(),
      Prompts.EMPTY_PLAN,
      emptyLine(),
    ]
  }
  const actionCount = formatCountPlanItemTypes(plan)
  const planSteps = formatDetailedChanges(
    wu(plan.itemsByEvalOrder()).map(item => item.detailedChanges())
  )
  return [
    emptyLine(),
    header(Prompts.PLANSTEPSHEADER),
    planSteps,
    emptyLine(),
    subHeader(Prompts.EXPLAINPREVIEWRESULT),
    emptyLine(),
    actionCount,
    emptyLine(),
  ]
}

export const formatDeployPlan = (plan: Plan): string => {
  const executionOutput = formatExecution(plan)
  return [
    header(Prompts.STARTDEPLOY),
    subHeader(Prompts.EXPLAINDEPLOY),
  ].concat(executionOutput).join('\n')
}

export const formatPlan = (plan: Plan): string => {
  const executionOutput = formatExecution(plan)
  return executionOutput.concat([
    subHeader(Prompts.PREVIEWDISCLAIMER),
    emptyLine(),
  ]).join('\n')
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

const deployPhaseIndent = 2
const formatItemName = (itemName: string): string => indent(header(`${itemName}:`), deployPhaseIndent)

export const deployPhaseHeader = header([
  emptyLine(),
  Prompts.STARTDEPLOYEXEC,
  emptyLine(),
].join('\n'))

export const cancelDeployOutput = header([
  Prompts.CANCELDEPLOY,
  emptyLine(),
].join('\n'))

export const deployPhaseEpilogue = header([
  emptyLine(),
  Prompts.FINISHEDDEPLOYEXEC,
].join('\n'))

export const formatCancelAction = (itemName: string, parentItemName: string): string => {
  const formattedItemName = formatItemName(itemName)
  const formattedErrorMessage = error(`${Prompts.CANCELDEPLOYACTION} ${parentItemName}`)
  const elements = [
    `${formattedItemName} ${formattedErrorMessage}`,
    emptyLine(),
  ]
  return elements.join('\n')
}

export const formatItemError = (itemName: string, errorReason: string): string => {
  const formattedItemName = `${formatItemName(itemName)}`
  const formattedErrorMessage = error(`Failed: ${errorReason}`)
  return [
    `${formattedItemName} ${formattedErrorMessage}`,
    emptyLine(),
  ].join('\n')
}

export const formatItemDone = (item: PlanItem, startTime: Date): string => {
  const elapsed = getElapsedTime(startTime)
  const itemName = formatItemName(planItemName(item))
  const completedText = success(`${Prompts.ENDACTION[item.parent().action]}`
  + ` completed after ${elapsed}s`)
  const itemDone = [
    `${itemName} ${completedText}`,
    emptyLine(),
  ]
  return itemDone.join('\n')
}

export const formatActionStart = (action: PlanItem): string => {
  action.parent()
  const itemName = `${formatItemName(planItemName(action))}`
  const elements = [
    body(`${itemName} ${Prompts.STARTACTION[action.parent().action]}`),
    emptyLine(),
  ]
  return elements.join('\n')
}

export const formatActionInProgress = (
  itemName: string,
  actionName: ActionName,
  start: Date
): string => {
  const elapsed = getElapsedTime(start)
  const styledItemName = formatItemName(itemName)
  return body(`${styledItemName} Still ${
    Prompts.STARTACTION[actionName]
  } (${elapsed}s elapsed)\n`)
}

export const formatFetchChangeForApproval = (
  change: FetchChange,
  idx: number,
  totalChanges: number
): string => {
  const formattedChange = formatDetailedChanges([[change.serviceChange]])
  const formattedConflict = change.pendingChange === undefined ? [] : [
    header(Prompts.FETCH_CONFLICTING_CHANGE),
    body(formatDetailedChanges([[change.pendingChange]])),
  ]
  return [
    header(Prompts.FETCH_CHANGE_HEADER(idx + 1, totalChanges)),
    body(formattedChange),
    ...formattedConflict,
    header(Prompts.FETCH_SHOULD_APPROVE_CHANGE),
  ].join('\n')
}

export const formatChangesSummary = (changes: number, approved: number): string => {
  if (changes === 0) {
    return Prompts.FETCH_NO_CHANGES
  }
  if (approved === 0) {
    return Prompts.FETCH_NOTHING_TO_UPDATE
  }
  return Prompts.FETCH_CHANGES_TO_APPLY(approved)
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

const formatError = (err: {error: string}, severity: WorkspaceErrorSeverity): string => {
  const severityPainter = severity === 'Error' ? chalk.red : chalk.yellow
  return `${severityPainter(chalk.bold(`${severity}:`))} ${chalk.bold(err.error)}`
}
const formatWorkspaceError = (we: Readonly<WorkspaceError>): string =>
  `${formatError(we, we.severity)}\n${fomratSourceFragments(we.sourceFragments)}`

export const formatWorkspaceErrors = (workspaceErrors: ReadonlyArray<WorkspaceError>): string =>
  `${Prompts.WORKSPACE_LOAD_FAILED}\n${workspaceErrors.map(formatWorkspaceError).join('\n\n')}\n`

export const formatMergeErrors = (mergeErrors: ReadonlyArray<MergeError>): string =>
  `${Prompts.FETCH_MERGE_ERRORS}${mergeErrors.map(me => formatError(me, 'Error')).join('\n')}`
