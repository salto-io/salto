/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { EOL } from 'os'
import chalk from 'chalk'
import wu, { WuIterable } from 'wu'
import {
  Element,
  isInstanceElement,
  Values,
  Change,
  Value,
  getChangeData,
  ElemID,
  isObjectType,
  isField,
  isPrimitiveType,
  Field,
  PrimitiveTypes,
  ReferenceExpression,
  ActionName,
  ChangeError,
  SaltoError,
  isElement,
  TypeMap,
  DetailedChange,
  ChangeDataType,
  isStaticFile,
  isSaltoElementError,
} from '@salto-io/adapter-api'
import {
  Plan,
  PlanItem,
  FetchChange,
  FetchResult,
  LocalChange,
  getSupportedServiceAdapterNames,
  DeployError,
  GroupProperties,
} from '@salto-io/core'
import { errors, SourceLocation, WorkspaceComponents, StateRecency } from '@salto-io/workspace'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import Prompts from './prompts'

const { awu } = collections.asynciterable
const { isDefined } = values

export const header = (txt: string): string => chalk.bold(txt)

export const subHeader = (txt: string): string => chalk.grey(txt)

export const body = (txt: string): string => chalk.reset(txt)

export const warn = (txt: string): string => chalk.yellow.bold(txt)

export const success = (txt: string): string => chalk.green(txt)

export const formatSuccess = (txt: string): string => `${success('✔')} ${txt}`

export const error = (txt: string): string => chalk.red.bold(txt)

export const emptyLine = (): string => ''

const planItemName = (step: PlanItem): string => step.groupKey

const formatError = (err: { message: string }): string => header(err.message)

export const formatWordsSeries = (words: string[]): string =>
  words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${_.last(words)}` : words[0]

/**
 * Format workspace errors
 */

const formatSourceLocation = (sl: Readonly<SourceLocation>): string =>
  `${chalk.underline(sl.sourceRange.filename)}(${chalk.cyan(`line: ${sl.sourceRange.start.line}`)})`

const formatSourceLocations = (sourceLocations: ReadonlyArray<SourceLocation>): string =>
  `${sourceLocations.map(formatSourceLocation).join(EOL)}`

export const formatWorkspaceError = (we: Readonly<errors.WorkspaceError<SaltoError>>): string => {
  const possibleEOL = we.sourceLocations.length > 0 ? EOL : ''
  return `${formatError(we)}${possibleEOL}${formatSourceLocations(we.sourceLocations)}`
}

const indent = (text: string, level: number): string => {
  const indentText = _.repeat('  ', level)
  return text
    .split(EOL)
    .map(line => `${indentText}${line}`)
    .join(EOL)
}

export const formatStepStart = (text: string, indentLevel?: number): string =>
  indent(`${chalk.yellow('>>>')} ${text}`, indentLevel ?? 1)
export const formatStepCompleted = (text: string, indentLevel?: number): string =>
  indent(`${chalk.green('vvv')} ${text}`, indentLevel ?? 1)
export const formatStepFailed = (text: string, indentLevel?: number): string =>
  indent(`${error('xxx')} ${text}`, indentLevel ?? 1)
export const formatShowWarning = (text: string, indentLevel?: number): string =>
  indent(`${chalk.red('!!!')} ${text}`, indentLevel ?? 1)
export const formatListRecord = (text: string, indentLevel?: number): string => indent(`○ ${text}`, indentLevel ?? 2)

const singleOrPluralString = (number: number, single: string, plural: string): string =>
  (number || 0) === 1 ? `${number} ${single}` : `${number} ${plural}`

const formatSimpleError = (errorMsg: string): string => header(error(`Error: ${errorMsg}`))

const formatValue = async (value: Element | Value): Promise<string> => {
  const formatAnnotations = async (annotations: Values): Promise<string> =>
    _.isEmpty(annotations) ? '' : formatValue(annotations)
  const formatAnnotationTypes = async (types: TypeMap): Promise<string> =>
    _.isEmpty(types) ? '' : indent(`\nannotations:${await formatValue(types)}`, 2)
  const formatFields = async (fields: Record<string, Field>): Promise<string> =>
    _.isEmpty(fields) ? '' : indent(`\nfields:${await formatValue(fields)}`, 2)
  if (isInstanceElement(value)) {
    return formatValue(value.value)
  }
  if (isObjectType(value)) {
    return [
      await formatAnnotations(value.annotations),
      await formatFields(value.fields),
      await formatAnnotationTypes(await value.getAnnotationTypes()),
    ].join('')
  }
  if (isPrimitiveType(value)) {
    const primitiveTypeNames = {
      [PrimitiveTypes.STRING]: 'string',
      [PrimitiveTypes.NUMBER]: 'number',
      [PrimitiveTypes.BOOLEAN]: 'boolean',
      [PrimitiveTypes.UNKNOWN]: 'unknown',
    }
    return [
      indent(`\nTYPE: ${primitiveTypeNames[value.primitive]}`, 2),
      await formatAnnotations(value.annotations),
      await formatAnnotationTypes(await value.getAnnotationTypes()),
    ].join('')
  }
  if (isField(value)) {
    return [
      indent(`\nTYPE: ${value.refType.elemID.getFullName()}`, 2),
      await formatAnnotations(value.annotations),
    ].join('')
  }
  if (_.isArray(value)) {
    return `[${await awu(value).map(formatValue).toArray()}]`
  }
  if (_.isPlainObject(value)) {
    const formattedKeys = (
      await awu(_.entries(value))
        .map(async ([k, v]) => `${k}: ${await formatValue(v)}`)
        .toArray()
    ).join('\n')
    return `\n${indent(`{\n${indent(formattedKeys, 1)}\n}`, 2)}`
  }
  if (value instanceof ReferenceExpression) {
    return isElement(value.value) ? value.elemID.getFullName() : formatValue(value.value)
  }
  return safeJsonStringify(value)
}

const isDummyChange = (change: DetailedChange): boolean =>
  change.action === 'modify' && change.data.before === undefined && change.data.after === undefined

const formatChangeData = async (change: DetailedChange): Promise<string> => {
  if (isDummyChange(change)) {
    // Dummy changes are only headers, so add a ":"
    return ':'
  }
  if (change.action === 'remove' || isStaticFile(getChangeData(change))) {
    // No need to emit any details about a remove change
    return ''
  }
  if (change.action === 'modify') {
    const { before, after } = change.data
    return `: ${await formatValue(before)} => ${await formatValue(after)}`
  }
  return `: ${await formatValue(_.get(change.data, 'before', _.get(change.data, 'after')))}`
}

export const formatChange = async (change: DetailedChange, withValue = false): Promise<string> => {
  const modifierType = isDummyChange(change) ? 'eq' : change.action
  const modifier = Prompts.MODIFIERS[modifierType]
  const id = change.id.isTopLevel() ? change.id.getFullName() : change.id.name
  return indent(`${modifier} ${id}${withValue ? await formatChangeData(change) : ''}`, change.id.nestingLevel)
}

const formatCountPlanItemTypes = (plan: Plan): string => {
  const items = (
    wu(plan.itemsByEvalOrder())
      .map(item => item.changes())
      .flatten(true) as WuIterable<Change<ChangeDataType>>
  )
    .map(getChangeData)
    .map(({ elemID }) => ({
      type: elemID.createTopLevelParentID().parent.idType,
      name: elemID.createTopLevelParentID().parent.getFullName(),
    }))
    .toArray()
  const counter = _(items)
    .uniqBy(item => item.name)
    .countBy('type')
    .value()
  return (
    `${chalk.bold('Impacts:')} ${singleOrPluralString(counter.type || 0, 'type', 'types')} ` +
    `and ${singleOrPluralString(counter.instance || 0, 'instance', 'instances')}.`
  )
}

export const formatDetailedChanges = async (
  changeGroups: Iterable<Iterable<DetailedChange>>,
  withValue = false,
): Promise<string> => {
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

  return (
    (
      await awu(changeGroups)
        .map(changes => [...changes])
        // Fill in all missing "levels" of each change group
        .map(addMissingEmptyChanges)
        // Sort changes so they show up nested correctly
        .map(changes => _.sortBy(changes, change => change.id.getFullName()))
        // Format changes
        .map(async changes => (await Promise.all(changes.map(change => formatChange(change, withValue)))).join('\n'))
        .toArray()
    ).join('\n\n')
  )
}

const getElapsedTime = (start: Date): number => Math.ceil((new Date().getTime() - start.getTime()) / 1000)

type ChangeWorkspaceError = errors.WorkspaceError<ChangeError>

export const formatChangeErrors = (wsChangeErrors: ReadonlyArray<ChangeWorkspaceError>, detailed = false): string => {
  const errorsIndent = 2
  const formatSingleChangeError = (changeError: ChangeWorkspaceError): string => {
    const formattedError = formatWorkspaceError(changeError)
    return indent(`${formattedError}${EOL}${changeError.severity}: ${changeError.detailedMessage}`, errorsIndent)
  }
  const formatElement = (changeError: ChangeWorkspaceError): string => {
    const possibleDetailed: string = detailed
      ? `${EOL}${indent(chalk.dim(changeError.detailedMessage), errorsIndent + 2)}`
      : ''
    return `${indent(changeError.elemID.getFullName(), errorsIndent + 1)}${possibleDetailed}`
  }
  const formatGroupedChangeErrors = (groupedChangeErrors: ChangeWorkspaceError[]): string => {
    const firstErr: ChangeWorkspaceError = groupedChangeErrors[0]
    if (firstErr.detailedMessage === '') {
      return ''
    }
    if (groupedChangeErrors.length === 1) {
      return formatSingleChangeError(firstErr)
    }

    const resultMessages: string = [
      indent(`${firstErr.severity}: ${formatError(firstErr)} in the following elements:`, errorsIndent),
    ]
      .concat(groupedChangeErrors.map(formatElement))
      .join(EOL)
    return resultMessages
  }
  const ret = _(wsChangeErrors)
    .groupBy(ce => ce.message)
    .values()
    .sortBy(errs => -errs.length)
    .map(formatGroupedChangeErrors)
    .join(EOL)
  return ret
}

export const formatDeployActions = ({
  wsChangeErrors,
  isPreDeploy,
}: {
  wsChangeErrors: ReadonlyArray<ChangeWorkspaceError | ChangeError>
  isPreDeploy: boolean
}): string[] => {
  const deployActions = _(wsChangeErrors)
    .uniqBy(wsError => wsError.message)
    .map(wsError => (isPreDeploy ? wsError.deployActions?.preAction : wsError.deployActions?.postAction))
    .filter(values.isDefined)
    .value()
  if (_.isEmpty(deployActions)) {
    return []
  }
  return [
    emptyLine(),
    header(isPreDeploy ? Prompts.DEPLOY_PRE_ACTION_HEADER : Prompts.DEPLOY_POST_ACTION_HEADER),
    emptyLine(),
    ...deployActions.flatMap(deployAction => [
      header(deployAction.title),
      deployAction.description ?? '',
      ...deployAction.subActions.map(action => indent(`- ${action}`, 1)),
      deployAction.documentationURL ?? '',
    ]),
    emptyLine(),
  ]
}

export const formatExecutionPlan = async (
  plan: Plan,
  workspaceErrors: ReadonlyArray<ChangeWorkspaceError>,
  detailed = false,
): Promise<string> => {
  const formattedPlanChangeErrors: string = formatChangeErrors(workspaceErrors, detailed)
  const preDeployCallToActions: string[] = formatDeployActions({
    wsChangeErrors: workspaceErrors,
    isPreDeploy: true,
  })
  const planErrorsOutput: string[] = _.isEmpty(formattedPlanChangeErrors)
    ? [emptyLine()]
    : [emptyLine(), header(Prompts.PLAN_CHANGE_ERRS_HEADER), formattedPlanChangeErrors, emptyLine()]
  if (_.isEmpty(plan)) {
    return [emptyLine(), Prompts.EMPTY_PLAN, ...planErrorsOutput, emptyLine()].join('\n')
  }
  const actionCount = formatCountPlanItemTypes(plan)
  const planSteps = await formatDetailedChanges(
    wu(plan.itemsByEvalOrder()).map(item => item.detailedChanges()),
    detailed,
  )
  return [
    emptyLine(),
    planSteps,
    ...planErrorsOutput,
    emptyLine(),
    ...preDeployCallToActions,
    subHeader(Prompts.EXPLAIN_PREVIEW_RESULT),
    actionCount,
    emptyLine(),
    emptyLine(),
  ].join('\n')
}

const deployPhaseIndent = 2
const formatItemName = (itemName: string): string => indent(header(`${itemName}:`), deployPhaseIndent)

export const deployPhaseHeader = (checkOnly: boolean): string =>
  header([emptyLine(), Prompts.START_DEPLOY_EXEC(checkOnly), emptyLine()].join('\n'))

export const cancelDeployOutput = (checkOnly: boolean): string =>
  [emptyLine(), Prompts.CANCEL_DEPLOY(checkOnly), emptyLine()].join('\n')

export const deployErrorsOutput = (allErrors: DeployError[]): string => {
  const getErrorMessage = (err: DeployError): string =>
    formatListRecord(`${isSaltoElementError(err) ? `${err.elemID.getFullName()}: ` : ''}${err.message}`, 1)
  const errorOutputLines = [emptyLine()]
  if (allErrors.length > 0) {
    const warnings = allErrors.filter(warning => warning.severity === 'Warning')
    const infos = allErrors.filter(info => info.severity === 'Info')
    const deployErrors = allErrors.filter(err => err.severity === 'Error')
    if (!_.isEmpty(deployErrors)) {
      errorOutputLines.push(error('Errors:'))
      deployErrors.forEach(deployError => errorOutputLines.push(error(getErrorMessage(deployError)), emptyLine()))
      errorOutputLines.push(emptyLine())
    }
    if (!_.isEmpty(warnings)) {
      errorOutputLines.push(warn('Warnings:'))
      warnings.forEach(warning => errorOutputLines.push(warn(getErrorMessage(warning)), emptyLine()))
      errorOutputLines.push(emptyLine())
    }
    if (!_.isEmpty(infos)) {
      errorOutputLines.push(header('Info:'))
      infos.forEach(info => errorOutputLines.push(header(getErrorMessage(info)), emptyLine()))
      errorOutputLines.push(emptyLine())
    }
    return errorOutputLines.join(EOL)
  }
  return ''
}

export const deployPhaseEpilogue = (numChanges: number, numErrors: number, checkOnly: boolean): string => {
  const hadChanges = numChanges > 0
  const hadErrors = numErrors > 0
  if (hadChanges || hadErrors) {
    const epilogueLines = [emptyLine()]
    if (hadChanges && hadErrors) {
      epilogueLines.push(Prompts.FULL_DEPLOY_SUMMARY(numChanges, numErrors))
    } else if (hadChanges) {
      epilogueLines.push(Prompts.CHANGES_DEPLOY_SUMMARY(numChanges, checkOnly))
    } else {
      epilogueLines.push(Prompts.ERRORS_DEPLOY_SUMMARY(numErrors, checkOnly))
    }
    return epilogueLines.join('\n')
  }
  return ''
}

export const formatCancelAction = (itemName: string, parentItemName: string): string => {
  const formattedItemName = formatItemName(itemName)
  const formattedErrorMessage = error(`${Prompts.CANCEL_DEPLOY_ACTION} ${parentItemName}`)
  const elements = [`${formattedItemName} ${formattedErrorMessage}`, emptyLine()]
  return elements.join('\n')
}

export const formatItemError = (itemName: string, errorReason: string): string => {
  const formattedItemName = `${formatItemName(itemName)}`
  const formattedErrorMessage = error(`Failed: ${errorReason}`)
  return [`${formattedItemName} ${formattedErrorMessage}`, emptyLine()].join('\n')
}

export const formatItemDone = (item: PlanItem, startTime: Date): string => {
  const elapsed = getElapsedTime(startTime)
  const itemName = formatItemName(planItemName(item))
  const completedText = success(`${Prompts.END_ACTION[item.action]} completed after ${elapsed}s`)
  const itemDone = [`${itemName} ${completedText}`, emptyLine()]
  return itemDone.join('\n')
}

export const formatActionStart = (action: PlanItem): string => {
  const itemName = `${formatItemName(planItemName(action))}`
  const elements = [body(`${itemName} ${Prompts.START_ACTION[action.action]}`), emptyLine()]
  return elements.join('\n')
}

export const formatActionInProgress = (itemName: string, actionName: ActionName, start: Date): string => {
  const elapsed = getElapsedTime(start)
  const styledItemName = formatItemName(itemName)
  return body(`${styledItemName} Still ${Prompts.START_ACTION[actionName]} (${elapsed}s elapsed)\n`)
}

export const formatFetchChangeForApproval = async (
  change: FetchChange,
  idx: number,
  totalChanges: number,
): Promise<string> => {
  const formattedChange = await formatDetailedChanges([change.serviceChanges], true)
  const formattedConflict =
    change.pendingChanges === undefined || _.isEmpty(change.pendingChanges)
      ? []
      : [header(Prompts.FETCH_CONFLICTING_CHANGE), body(await formatDetailedChanges([change.pendingChanges], true))]
  return [
    header(Prompts.FETCH_CHANGE_HEADER(idx + 1, totalChanges)),
    body(formattedChange),
    ...formattedConflict,
    header(Prompts.FETCH_SHOULD_APPROVE_CHANGE),
  ].join('\n')
}

export const formatAppliedChanges = (appliedChanges: number): string => {
  if (appliedChanges === 0) {
    return Prompts.FETCH_NO_CHANGES
  }
  return Prompts.FETCH_CHANGES_APPLIED(appliedChanges)
}

export const formatConfigFieldInput = (fieldName: string, message: string): string =>
  `${message ?? _.capitalize(fieldName)}:`

export const formatCredentialsHeader = (adapterName: string): string =>
  [Prompts.CREDENTIALS_HEADER(_.capitalize(adapterName)), emptyLine()].join('\n')

export const formatGoToBrowser = (url: string): string => [Prompts.GO_TO_BROWSER(url), emptyLine()].join('\n')

export const formatFetchHeader = (): string =>
  [emptyLine(), header(Prompts.FETCH_HEADER), subHeader(Prompts.FETCH_SUB_HEADER)].join('\n')

export const formatFetchFinish = (): string => [emptyLine(), Prompts.FETCH_SUCCESS_FINISHED].join('\n')

export const formatMergeErrors = (mergeErrors: FetchResult['mergeErrors']): string =>
  `${Prompts.FETCH_MERGE_ERRORS}\n${mergeErrors
    .map(me => `${formatError(me.error)}, dropped elements: ${me.elements.map(e => e.elemID.getFullName()).join(', ')}`)
    .join('\n')}`

export const formatFetchWarnings = (warnings: string[]): string =>
  [emptyLine(), `${Prompts.FETCH_WARNINGS}\n${warnings.join('\n\n')}`].join('\n')

export const formatWorkspaceLoadFailed = (numErrors: number): string =>
  formatSimpleError(`${Prompts.WORKSPACE_LOAD_FAILED(numErrors)}`)

export const formatWorkspaceAbort = (numErrors: number): string =>
  formatSimpleError(`${Prompts.WORKSPACE_LOAD_ABORT(numErrors)}\n`)

export const formatShouldContinueWithWarning = (numWarnings: number): string =>
  warn(Prompts.SHOULD_CONTINUE(numWarnings))

export const formatShouldAbortWithValidationError = (numErrors: number): string =>
  error(Prompts.SHOULD_ABORT(numErrors))

export const formatConfigChangeNeeded = (introMessage: string, formattedChanges: string): string =>
  Prompts.CONFIG_CHANGE_NEEDED(introMessage, formattedChanges)

export const formatShouldCancelWithOldState = warn(Prompts.SHOULD_CANCEL_WITH_OLD_STATE)

export const formatShouldCancelWithNonexistentState = warn(Prompts.SHOULD_CANCEL_WITH_NONEXISTENT_STATE)

export const formatCancelCommand = header(`${Prompts.CANCELED}\n`)

export const formatShouldChangeFetchModeToAlign = (fetchMode: string): string =>
  warn(Prompts.FETCH_SHOULD_ALIGN_FETCH_MODE(fetchMode))
export const formatChangingFetchMode = header(`${Prompts.FETCH_CHANGING_FETCH_MODE_TO_ALIGN}\n`)
export const formatNotChangingFetchMode = header(`${Prompts.FETCH_NOT_CHANGING_FETCH_MODE}\n`)

export const formatLoginUpdated = [formatSuccess(Prompts.ACCOUNTS_LOGIN_UPDATED), emptyLine()].join('\n')

export const formatLoginOverride = [Prompts.ACCOUNTS_LOGIN_OVERRIDE, emptyLine(), emptyLine()].join('\n')

export const formatAccountConfigured = (accountName: string): string =>
  [Prompts.ACCOUNT_CONFIGURED(accountName), emptyLine()].join('\n')

export const formatAccountNotConfigured = (accountName: string): string =>
  [Prompts.ACCOUNT_NOT_CONFIGURED(accountName), emptyLine(), Prompts.ACCOUNT_HOW_ADD(accountName), emptyLine()].join(
    '\n',
  )

const formatConfiguredAccounts = (accountNames: ReadonlyArray<string>): string => {
  if (accountNames.length === 0) {
    return [Prompts.NO_CONFIGURED_ACCOUNTS, emptyLine()].join('\n')
  }

  const formattedAccounts = accountNames.map(account => indent(`* ${account}`, 1))
  formattedAccounts.unshift(Prompts.CONFIGURED_ACCOUNTS_TITLE)
  formattedAccounts.push(emptyLine())
  return formattedAccounts.join('\n')
}

export const getPrivateAdaptersNames = (): ReadonlyArray<string> => ['dummy']

const formatAdditionalAccounts = (accounts: ReadonlyArray<string>): string => {
  const formattedAccounts = getSupportedServiceAdapterNames()
    .filter(accountName => !accounts.includes(accountName) && !getPrivateAdaptersNames().includes(accountName))
    .map(accountName => indent(`- ${accountName}`, 1))
  if (formattedAccounts.length === 0) {
    return Prompts.NO_ADDITIONAL_CONFIGURED_ACCOUNTS.concat(EOL)
  }

  formattedAccounts.unshift(Prompts.ADDITIONAL_SUPPORTED_SERVICES_TITLE)
  formattedAccounts.push(emptyLine())
  return formattedAccounts.join(EOL)
}

export const formatConfiguredAndAdditionalAccounts = (accounts: ReadonlyArray<string>): string =>
  [formatConfiguredAccounts(accounts), formatAdditionalAccounts(accounts)].join(EOL)

export const formatAccountAdded = (accountName: string): string =>
  [formatSuccess(Prompts.ACCOUNT_ADDED(accountName)), emptyLine(), emptyLine()].join('\n')

export const formatAccountAlreadyAdded = (accountName: string): string =>
  [formatSimpleError(Prompts.ACCOUNT_ALREADY_ADDED(accountName)), emptyLine()].join('\n')

export const formatInvalidServiceInput = (serviceName: string, supportedServiceAdapters: string[]): string => {
  const privateAdapterNames = getPrivateAdaptersNames()
  const isPrivateServiceName = (service: string): boolean => privateAdapterNames.includes(service)
  return [
    formatSimpleError(
      Prompts.SERVICE_NAME_NOT_VALID(
        serviceName,
        supportedServiceAdapters
          .filter(supportedServiceAdapter => !isPrivateServiceName(supportedServiceAdapter))
          .map(nonPrivateServiceName => indent(`- ${nonPrivateServiceName}`, 1)),
      ),
    ),
    emptyLine(),
  ].join('\n')
}

export const formatLoginToAccountFailed = (accountName: string, errorMessage: string): string =>
  [
    formatSimpleError(Prompts.ACCOUNT_LOGIN_FAILED(accountName, errorMessage)),
    Prompts.ACCOUNT_LOGIN_FAILED_TRY_AGAIN(accountName),
    emptyLine(),
  ].join('\n')

export const formatAddServiceFailed = (serviceName: string, errorMessage: string): string =>
  [
    formatSimpleError(Prompts.ACCOUNT_LOGIN_FAILED(serviceName, errorMessage)),
    Prompts.ACCOUNT_ADD_FAILED_TRY_AGAIN(serviceName),
    emptyLine(),
  ].join('\n')

export const formatEnvListItem = (envNames: ReadonlyArray<string>, currentEnv?: string): string =>
  envNames.map(name => `${name === currentEnv ? '*' : ' '} ${name}`).join('\n')

export const formatCurrentEnv = (envName?: string): string =>
  envName ? [Prompts.WORKING_ON_ENV, envName].join(' ') : Prompts.NO_CURRENT_ENV

export const formatSetEnv = (envName: string): string => [Prompts.SET_ENV, envName].join(' ')

export const formatCreateEnv = (envName: string): string => Prompts.CREATED_ENV(envName)

export const formatDeleteEnv = (envName: string): string => Prompts.DELETED_ENV(envName)

export const formatRenameEnv = (currentEnvName: string, newEnvName: string): string =>
  Prompts.RENAME_ENV(currentEnvName, newEnvName)

export const formatFinishedLoading = (envName?: string): string =>
  envName ? [Prompts.FINISHED_LOADING_FOR_ENV, envName].join(' ') : Prompts.FINISHED_LOADING

export const formatApproveIsolateCurrentEnvPrompt = (envName: string): string =>
  Prompts.ISOLATE_FIRST_ENV_RECOMMENDATION(envName)

export const formatDoneIsolatingCurrentEnv = (envName: string): string => Prompts.DONE_ISOLATING_FIRST_ENV(envName)

export const formatStateChanges = (numOfChanges: number): string =>
  numOfChanges > 0 ? Prompts.STATE_ONLY_UPDATE_START(numOfChanges) : Prompts.STATE_NO_CHANGES

export const formatRestoreFinish = (): string => [emptyLine(), Prompts.RESTORE_SUCCESS_FINISHED].join('\n')

export const formatInvalidFilters = (invalidFilters: string[]): string =>
  [formatSimpleError(Prompts.INVALID_FILTERS(formatWordsSeries(invalidFilters))), emptyLine()].join('\n')

export const formatNonTopLevelSelectors = (invalidSelectors: string[]): string =>
  [formatSimpleError(Prompts.NON_TOP_LEVEL_SELECTORS(formatWordsSeries(invalidSelectors))), emptyLine()].join('\n')

export const formatMissingElementSelectors = (): string =>
  [formatSimpleError(Prompts.MISSING_ELEMENT_SELECTORS), emptyLine()].join('\n')

export const formatUnknownTargetEnv = (unknownEnvs: string[]): string =>
  [formatSimpleError(Prompts.UNKNOWN_TARGET_ENVS(unknownEnvs)), emptyLine()].join('\n')

export const formatTargetEnvRequired = (): string =>
  [formatSimpleError(Prompts.TARGET_ENVS_REQUIRED), emptyLine()].join('\n')

export const formatInvalidEnvTargetCurrent = (): string =>
  [formatSimpleError(Prompts.INVALID_ENV_TARGET_CURRENT), emptyLine()].join('\n')

export const formatMissingCloneArg = (): string =>
  [formatSimpleError(Prompts.MISSING_CLONE_ARG), emptyLine()].join('\n')

export const formatCloneToEnvFailed = (errorMessage: string): string =>
  [formatSimpleError(Prompts.CLONE_TO_ENV_FAILED(errorMessage)), emptyLine()].join('\n')

export const formatMoveFailed = (errorMessage: string): string =>
  [formatSimpleError(Prompts.MOVE_FAILED(errorMessage)), emptyLine()].join('\n')

export const formatElementListUnresolvedFailed = (errorMessage: string): string =>
  [formatSimpleError(Prompts.LIST_UNRESOLVED_FAILED(errorMessage)), emptyLine()].join('\n')

export const formatInvalidElementCommand = (command: string): string =>
  [formatSimpleError(Prompts.INVALID_MOVE_ARG(command)), emptyLine()].join('\n')

export const formatListFailed = (command: string): string =>
  [formatSimpleError(Prompts.LIST_FAILED(command)), emptyLine()].join('\n')

export const formatCleanWorkspace = (cleanArgs: WorkspaceComponents): string => {
  const componentsToClean = Object.entries(cleanArgs)
    .filter(([_comp, shouldClean]) => shouldClean)
    .map(([comp]) => _.startCase(comp).toLowerCase())
  return Prompts.CLEAN_WORKSPACE_SUMMARY(componentsToClean)
}

export const formatListUnresolvedFound = (env: string, elemIDs: ElemID[]): string =>
  [Prompts.LIST_UNRESOLVED_FOUND(env), ...elemIDs.map(id => `  ${id.getFullName()}`), emptyLine()].join('\n')

export const formatListUnresolvedMissing = (elemIDs: ElemID[]): string =>
  [Prompts.LIST_UNRESOLVED_MISSING(), ...elemIDs.map(id => `  ${id.getFullName()}`), emptyLine()].join('\n')

export const formatEnvDiff = async (
  changes: LocalChange[],
  detailed: boolean,
  toEnv: string,
  fromEnv: string,
): Promise<string> => {
  const changesStr =
    changes.length > 0 ? await formatDetailedChanges([changes.map(change => change.change)], detailed) : 'No changes'
  return [emptyLine(), header(Prompts.DIFF_CALC_DIFF_RESULT_HEADER(toEnv, fromEnv)), changesStr, emptyLine()].join('\n')
}

export const formatStateRecencies = (stateRecencies: StateRecency[]): string =>
  stateRecencies
    .map(recency =>
      recency.status === 'Nonexistent'
        ? Prompts.NONEXISTENT_STATE(recency.accountName ?? recency.serviceName)
        : Prompts.STATE_RECENCY(recency.accountName ?? recency.serviceName, recency.date as Date),
    )
    .join(EOL)

export const formatAdapterProgress = (adapterName: string, progressMessage: string): string =>
  subHeader(indent(Prompts.FETCH_PROGRESSING_MESSAGES(adapterName, progressMessage), 4))

type QuickDeployableGroup = GroupProperties & {
  requestId: string
  hash: string
}

const isQuickDeployableGroup = (group: GroupProperties): group is QuickDeployableGroup =>
  group.requestId !== undefined && group.hash !== undefined

export const formatGroups = (groups: GroupProperties[], checkOnly: boolean): string => {
  const quickDeployableGroups = groups.filter(isQuickDeployableGroup)
  const deploymentUrls = groups.map(group => group.url).filter(isDefined)
  const res: string[] = []
  if (!_.isEmpty(quickDeployableGroups)) {
    res.push(Prompts.VALIDATION_PARAMETERS)
    quickDeployableGroups.forEach(group => res.push(Prompts.QUICK_DEPLOY_PARAMETERS(group.requestId, group.hash)))
  }

  if (!_.isEmpty(deploymentUrls)) {
    res.push(Prompts.DEPLOYMENT_URLS(checkOnly, deploymentUrls))
  }
  return res.join('\n')
}
