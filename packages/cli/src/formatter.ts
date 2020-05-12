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
import chalk from 'chalk'
import wu from 'wu'
import {
  Element, isInstanceElement, Values, Change, Value, getChangeElement, ElemID,
  isObjectType, isField, isPrimitiveType, Field, PrimitiveTypes, ReferenceExpression,
  ActionName, ChangeError, SaltoError, isElement, TypeMap,
} from '@salto-io/adapter-api'
import {
  Plan, PlanItem, DetailedChange, WorkspaceError,
  SourceFragment, FetchChange, FetchResult, SourceRange,
} from '@salto-io/core'
import Prompts from './prompts'

export const header = (txt: string): string => chalk.bold(txt)

export const subHeader = (txt: string): string => chalk.grey(txt)

export const body = (txt: string): string => chalk.reset(txt)

export const warn = (txt: string): string => chalk.yellow.bold(txt)

export const success = (txt: string): string => chalk.green(txt)

export const formatSuccess = (txt: string): string => `${success('✔')} ${txt}`

export const error = (txt: string): string => chalk.red.bold(txt)

export const emptyLine = (): string => ''

const fullName = (change: Change): string => getChangeElement(change).elemID.getFullName()

const planItemName = (step: PlanItem): string => fullName(step.parent())

const formatError = (err: { message: string }): string => header(err.message)

export const formatWordsSeries = (words: string[]): string => (words.length > 1
  ? `${words.slice(0, -1).join(', ')} and ${_.last(words)}`
  : words[0])

/**
  * Format workspace errors
  */
const TAB = '  '

const formatSourceFragmentHeader = (headerMetaData: SourceRange): string =>
  `${chalk.underline(headerMetaData.filename)}(${chalk.cyan(`line: ${headerMetaData.start.line}`)})\n`

const formatSourceFragmentWithsubRange = (sf: Readonly<SourceFragment>): string => {
  const sourceSubRange = sf.subRange ?? sf.sourceRange
  const beforeSubRange = sf.fragment.slice(0, sourceSubRange.start.byte - sf.sourceRange.start.byte)
  let subRange = sf.fragment.slice(sourceSubRange.start.byte - sf.sourceRange.start.byte,
    sourceSubRange.end.byte - sf.sourceRange.start.byte)
  subRange = subRange === '\n' ? '\\n\n' : subRange
  const afterSubRange = sf.fragment.slice(sourceSubRange.end.byte - sf.sourceRange.start.byte)
  return `${formatSourceFragmentHeader(sourceSubRange)}${TAB}${
    subHeader(beforeSubRange)
  }${chalk.white(subRange)
  }${subHeader(afterSubRange)}\n`
}

const formatSourceFragmentWithoutsubRange = (sf: Readonly<SourceFragment>): string =>
  `${formatSourceFragmentHeader(sf.sourceRange)}${TAB}${
    subHeader(sf.fragment.split('\n').join(`\n${TAB}`))}\n`

const formatSourceFragment = (sf: Readonly<SourceFragment>): string =>
  (sf.subRange ? formatSourceFragmentWithsubRange(sf) : formatSourceFragmentWithoutsubRange(sf))

const formatSourceFragments = (sourceFragments: ReadonlyArray<SourceFragment>): string =>
  (sourceFragments.length > 0
    ? `\n on ${sourceFragments.map(formatSourceFragment).join('\n and ')}`
    : '')

export const formatWorkspaceError = (we: Readonly<WorkspaceError<SaltoError>>): string =>
  `${formatError(we)}${formatSourceFragments(we.sourceFragments)}`

const indent = (text: string, level: number): string => {
  const indentText = _.repeat('  ', level)
  return text.split('\n').map(line => `${indentText}${line}`).join('\n')
}

const singleOrPluralString = (number: number, single: string, plural: string): string =>
  ((number || 0) === 1 ? `${number} ${single}` : `${number} ${plural}`)

const formatSimpleError = (errorMsg: string): string => header(error(`Error: ${errorMsg}`))

const formatValue = (value: Element | Value): string => {
  const formatAnnotations = (annotations: Values): string =>
    (_.isEmpty(annotations) ? '' : formatValue(annotations))
  const formatAnnotationTypes = (types: TypeMap): string =>
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
    const primitiveTypeNames = {
      [PrimitiveTypes.STRING]: 'string',
      [PrimitiveTypes.NUMBER]: 'number',
      [PrimitiveTypes.BOOLEAN]: 'boolean',
    }
    return [
      indent(`\nTYPE: ${primitiveTypeNames[value.primitive]}`, 2),
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
  if (value instanceof ReferenceExpression) {
    return isElement(value.value) ? value.elemId.getFullName() : formatValue(value.value)
  }
  return JSON.stringify(value)
}

const isDummyChange = (change: DetailedChange): boolean => (
  change.action === 'modify' && change.data.before === undefined && change.data.after === undefined
)

const formatChangeData = (change: DetailedChange): string => {
  if (isDummyChange(change)) {
    // Dummy changes are only headers, so add a ":"
    return ':'
  }
  if (change.action === 'remove') {
    // No need to emit any details about a remove change
    return ''
  }
  if (change.action === 'modify') {
    const { before, after } = change.data
    return `: ${formatValue(before)} => ${formatValue(after)}`
  }
  return `: ${formatValue(_.get(change.data, 'before', _.get(change.data, 'after')))}`
}

export const formatChange = (change: DetailedChange, withValue = false): string => {
  const modifierType = isDummyChange(change) ? 'eq' : change.action
  const modifier = Prompts.MODIFIERS[modifierType]
  const id = change.id.isTopLevel() ? change.id.getFullName() : change.id.name
  return indent(
    `${modifier} ${id}${withValue ? formatChangeData(change) : ''}`,
    change.id.nestingLevel,
  )
}

const formatCountPlanItemTypes = (plan: Plan): string => {
  const items = wu(plan.itemsByEvalOrder())
    .map(item => ({
      type: getChangeElement(item.parent()).elemID.idType,
      name: planItemName(item),
    })).unique().toArray()
  const counter = _.countBy(items, 'type')
  return `${chalk.bold('Impacts:')} ${singleOrPluralString(counter.type || 0, 'type', 'types')} `
    + `and ${singleOrPluralString(counter.instance || 0, 'instance', 'instances')}.`
}

export const formatDetailedChanges = (
  changeGroups: Iterable<Iterable<DetailedChange>>, withValue = false,
): string => {
  const addMissingEmptyChanges = (changes: DetailedChange[]): DetailedChange[] => {
    const emptyChange = (id: ElemID): DetailedChange => ({
      action: 'modify',
      data: { before: undefined, after: undefined },
      id,
    })

    const formatMissingChanges = (id: ElemID, existingIds: Set<string>): DetailedChange[] => {
      const parentId = id.createParentID()
      if (id.isTopLevel() || existingIds.has(parentId.getFullName())) {
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
    .map(changes => changes.map(change => formatChange(change, withValue)).join('\n'))
    .toArray()
    .join('\n\n')
}

const getElapsedTime = (start: Date): number => Math.ceil(
  (new Date().getTime() - start.getTime()) / 1000,
)

type ChangeWorkspaceError = WorkspaceError<ChangeError>

export const formatChangeErrors = (
  wsChangeErrors: ReadonlyArray<ChangeWorkspaceError>
): string => {
  const formatGroupedChangeErrors = (groupedChangeErrors: ChangeWorkspaceError[]): string => {
    const errorsIndent = 2
    const firstErr: ChangeWorkspaceError = groupedChangeErrors[0]
    if (groupedChangeErrors.length > 1) {
      return indent(`${firstErr.severity}: ${formatError(firstErr)} (${groupedChangeErrors.length} Elements)`,
        errorsIndent)
    }
    const formattedError = formatWorkspaceError(firstErr)
    return indent(`${formattedError}${firstErr.severity}: ${firstErr.detailedMessage}`,
      errorsIndent)
  }
  const ret = _(wsChangeErrors)
    .groupBy(ce => ce.message)
    .values()
    .sortBy(errs => -errs.length)
    .map(formatGroupedChangeErrors)
    .join('\n')
  return ret
}


export const formatExecutionPlan = (
  plan: Plan,
  workspaceErrors: ReadonlyArray<ChangeWorkspaceError>
): string => {
  const formattedPlanChangeErrors: string = formatChangeErrors(
    workspaceErrors
  )
  const planErrorsOutput: string[] = _.isEmpty(formattedPlanChangeErrors)
    ? [emptyLine()]
    : [emptyLine(),
      header(Prompts.PLAN_CHANGE_ERRS_HEADER),
      formattedPlanChangeErrors, emptyLine(),
    ]
  if (_.isEmpty(plan)) {
    return [
      emptyLine(),
      Prompts.EMPTY_PLAN,
      ...planErrorsOutput,
      emptyLine(),
    ].join('\n')
  }
  const actionCount = formatCountPlanItemTypes(plan)
  const planSteps = formatDetailedChanges(
    wu(plan.itemsByEvalOrder()).map(item => item.detailedChanges())
  )
  return [
    emptyLine(),
    planSteps,
    ...planErrorsOutput,
    emptyLine(),
    subHeader(Prompts.EXPLAIN_PREVIEW_RESULT),
    actionCount,
    emptyLine(),
    emptyLine(),
  ].join('\n')
}

const deployPhaseIndent = 2
const formatItemName = (itemName: string): string => indent(header(`${itemName}:`), deployPhaseIndent)

export const deployPhaseHeader = header([
  emptyLine(),
  Prompts.START_DEPLOY_EXEC,
  emptyLine(),
].join('\n'))

export const cancelDeployOutput = [
  emptyLine(),
  Prompts.CANCEL_DEPLOY,
  emptyLine(),
].join('\n')

export const deployPhaseEpilogue = (numChanges: number, numErrors: number): string => {
  const hadChanges = numChanges > 0
  const hadErrors = numErrors > 0
  if (hadChanges || hadErrors) {
    const epilogueLines = [
      emptyLine(),
    ]
    if (hadChanges && hadErrors) {
      epilogueLines.push(Prompts.FULL_DEPLOY_SUMMARY(numChanges, numErrors))
    } else if (hadChanges) {
      epilogueLines.push(Prompts.CHANGES_DEPLOY_SUMMARY(numChanges))
    } else {
      epilogueLines.push(Prompts.ERRORS_DEPLOY_SUMMARY(numErrors))
    }
    return epilogueLines.join('\n')
  }
  return ''
}

export const formatCancelAction = (itemName: string, parentItemName: string): string => {
  const formattedItemName = formatItemName(itemName)
  const formattedErrorMessage = error(`${Prompts.CANCEL_DEPLOY_ACTION} ${parentItemName}`)
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
  const completedText = success(`${Prompts.END_ACTION[item.parent().action]}`
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
    body(`${itemName} ${Prompts.START_ACTION[action.parent().action]}`),
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
    Prompts.START_ACTION[actionName]
  } (${elapsed}s elapsed)\n`)
}

export const formatFetchChangeForApproval = (
  change: FetchChange,
  idx: number,
  totalChanges: number
): string => {
  const formattedChange = formatDetailedChanges([[change.serviceChange]], true)
  const formattedConflict = change.pendingChange === undefined ? [] : [
    header(Prompts.FETCH_CONFLICTING_CHANGE),
    body(formatDetailedChanges([[change.pendingChange]], true)),
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

export const formatConfigFieldInput = (fieldName: string, message: string): string =>
  `${message ?? _.capitalize(fieldName)}:`

export const formatCredentialsHeader = (adapterName: string): string => [
  Prompts.CREDENTIALS_HEADER(_.capitalize(adapterName)),
  emptyLine(),
].join('\n')

export const formatFetchHeader = (): string => [
  emptyLine(),
  header(Prompts.FETCH_HEADER),
  subHeader(Prompts.FETCH_SUB_HEADER),
].join('\n')
export const formatFetchFinish = (): string => [
  emptyLine(),
  Prompts.FETCH_SUCCESS_FINISHED,
].join('\n')
export const formatStepStart = (text: string, indentLevel?: number): string => indent(`${chalk.yellow('>>>')} ${text}`, indentLevel ?? 1)
export const formatStepCompleted = (text: string, indentLevel?: number): string => indent(`${chalk.green('vvv')} ${text}`, indentLevel ?? 1)
export const formatStepFailed = (text: string, indentLevel?: number): string => indent(`${error('xxx')} ${text}`, indentLevel ?? 1)

export const formatMergeErrors = (mergeErrors: FetchResult['mergeErrors']): string =>
  `${Prompts.FETCH_MERGE_ERRORS}${mergeErrors.map(
    me => `${formatError(me.error)}, dropped elements: ${
      me.elements.map(e => e.elemID.getFullName()).join(', ')
    }`
  ).join('\n')}`

export const formatFatalFetchError = (mergeErrors: FetchResult['mergeErrors']): string =>
  formatSimpleError(`${Prompts.FETCH_FATAL_MERGE_ERROR_PREFIX}${
    mergeErrors.map(c => `Error: ${c.error.message}, Elements: ${c.elements.map(e => e.elemID.getFullName()).join(', ')}\n`)
  }`)

export const formatWorkspaceLoadFailed = (numErrors: number): string =>
  formatSimpleError(`${Prompts.WORKSPACE_LOAD_FAILED(numErrors)}`)

export const formatWorkspaceAbort = (numErrors: number): string =>
  formatSimpleError(
    `${Prompts.WORKSPACE_LOAD_ABORT(numErrors)}\n`
  )

export const formatShouldContinueWithWarning = (numWarnings: number): string =>
  warn(Prompts.SHOULD_CONTINUE(numWarnings))

export const formatShouldAbortWithValidationError = (numErrors: number): string =>
  error(Prompts.SHOULD_ABORT(numErrors))

export const formatConfigChangeNeeded = (introMessage: string, formattedChanges: string):
string => Prompts.CONFIG_CHANGE_NEEDED(introMessage, formattedChanges)

export const formatShouldCancelWithOldState = warn(Prompts.SHOULD_CANCEL_WITH_OLD_STATE)

export const formatShouldCancelWithNonexistentState = warn(
  Prompts.SHOULD_CANCEL_WITH_NONEXISTENT_STATE
)

export const formatCancelCommand = header(`${Prompts.CANCELED}\n`)

export const formatLoginUpdated = [
  formatSuccess(Prompts.SERVICES_LOGIN_UPDATED),
  emptyLine(),
].join('\n')

export const formatLoginOverride = [
  Prompts.SERVICES_LOGIN_OVERRIDE,
  emptyLine(),
  emptyLine(),
].join('\n')

export const formatServiceConfigured = (serviceName: string): string => [
  Prompts.SERVICE_CONFIGURED(serviceName),
  emptyLine(),
].join('\n')

export const formatServiceNotConfigured = (serviceName: string): string => [
  Prompts.SERVICE_NOT_CONFIGURED(serviceName),
  emptyLine(),
  Prompts.SERVICE_HOW_ADD(serviceName),
  emptyLine(),
].join('\n')

export const formatConfiguredServices = (serviceNames: ReadonlyArray<string>): string => {
  if (serviceNames.length === 0) {
    return [
      Prompts.NO_CONFIGURED_SERVICES,
      emptyLine(),
    ].join('\n')
  }

  const formattedServices = serviceNames.map(service => indent(`* ${service}`, 1))
  formattedServices.unshift(Prompts.CONFIGURED_SERVICES_TITLE)
  formattedServices.push(emptyLine())
  return formattedServices.join('\n')
}

export const formatServiceAdded = (serviceName: string): string => [
  formatSuccess(Prompts.SERVICE_ADDED(serviceName)),
  emptyLine(),
  emptyLine(),
].join('\n')

export const formatServiceAlreadyAdded = (serviceName: string): string => [
  formatSimpleError(Prompts.SERVICE_ALREADY_ADDED(serviceName)),
  emptyLine(),
].join('\n')

export const formatLoginToServiceFailed = (serviceName: string, errorMessage: string): string => [
  formatSimpleError(Prompts.SERVICE_LOGIN_FAILED(serviceName, errorMessage)),
  Prompts.SERVICE_LOGIN_FAILED_TRY_AGAIN(serviceName),
  emptyLine(),
].join('\n')

export const formatEnvListItem = (envNames: ReadonlyArray<string>, currentEnv?: string): string => (
  envNames
    .map(name => `${name === currentEnv ? '*' : ' '} ${name}`)
    .join('\n')
)

export const formatCurrentEnv = (envName?: string): string => (
  envName
    ? [Prompts.WORKING_ON_ENV, envName].join(' ')
    : Prompts.NO_CURRENT_ENV
)

export const formatSetEnv = (envName: string): string => (
  [Prompts.SET_ENV, envName].join(' ')
)

export const formatCreateEnv = (envName: string): string => Prompts.CREATED_ENV(envName)

export const formatDeleteEnv = (envName: string): string => Prompts.DELETED_ENV(envName)

export const formatRenameEnv = (currentEnvName: string, newEnvName: string): string =>
  Prompts.RENAME_ENV(currentEnvName, newEnvName)

export const formatFinishedLoading = (envName?: string): string => (
  envName
    ? [Prompts.FINISHED_LOADING_FOR_ENV, envName].join(' ')
    : Prompts.FINISHED_LOADING
)

export const formatApproveIsolatedModePrompt = (
  newServices: string[],
  oldServices: string[],
  isolatedInput: boolean
): string => {
  if (_.isEmpty(oldServices)) {
    return Prompts.ISOLATED_MODE_FOR_NEW_ENV_RECOMMENDATION
  }
  return isolatedInput
    ? Prompts.NEW_SERVICES_ISOLATED_RECOMMENDATION(
      formatWordsSeries(newServices),
    )
    : Prompts.ONLY_NEW_SERVICES_ISOLATED_RECOMMENDATION(
      formatWordsSeries(newServices),
      formatWordsSeries(oldServices)
    )
}
