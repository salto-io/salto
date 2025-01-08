/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Adapter,
  AdapterFormat,
  AdapterOperationsContext,
  Change,
  ChangeDataType,
  Element,
  getChangeData,
  isAdditionChange,
  isModificationChange,
  ReadOnlyElementsSource,
  SaltoError,
  toChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { merger, Workspace, ElementSelector, expressions, elementSource, hiddenValues } from '@salto-io/workspace'
// for backward compatibility
import { adapterCreators as allAdapterCreators } from '@salto-io/adapter-creators'
import { FetchResult } from '../types'
import { MergeErrorWithElements, getFetchAdapterAndServicesSetup, calcFetchChanges } from './fetch'
import { getPlan } from './plan'

const log = logger(module)
const { awu } = collections.asynciterable
const { makeArray } = collections.array

type GetAdapterArgs = {
  workspace: Workspace
  accountName: string
  adapterCreators: Record<string, Adapter>
}

const getAdapter = ({
  workspace,
  accountName,
  adapterCreators,
}: GetAdapterArgs):
  | { adapter: Adapter; adapterName: string; error: undefined }
  | { adapter: undefined; adapterName: undefined; error: SaltoError } => {
  const adapterName = workspace.getServiceFromAccountName(accountName)
  if (adapterName !== accountName) {
    return {
      adapter: undefined,
      adapterName: undefined,
      error: {
        severity: 'Error',
        message: 'Account name that is different from the adapter name is not supported',
        detailedMessage: '',
      },
    }
  }

  return { adapter: adapterCreators[adapterName], adapterName, error: undefined }
}

type GetAdapterAndContextArgs = {
  ignoreStateElemIdMapping?: boolean
  ignoreStateElemIdMappingForSelectors?: ElementSelector[]
} & GetAdapterArgs

type GetAdapterAndContextResult = {
  adapter: Adapter
  adapterContext: AdapterOperationsContext
  resolvedElements: Element[]
}

const getAdapterAndContext = async ({
  workspace,
  accountName,
  ignoreStateElemIdMapping,
  ignoreStateElemIdMappingForSelectors,
  adapterCreators,
}: GetAdapterAndContextArgs): Promise<GetAdapterAndContextResult> => {
  const { adapter, adapterName, error } = getAdapter({ workspace, accountName, adapterCreators })
  if (error !== undefined) {
    throw new Error(error.message)
  }

  const workspaceElements = await workspace.elements()
  const resolvedElements = await expressions.resolve(
    await awu(await workspaceElements.getAll()).toArray(),
    workspaceElements,
  )
  const { adaptersCreatorConfigs } = await getFetchAdapterAndServicesSetup({
    workspace,
    fetchAccounts: [accountName],
    accountToServiceNameMap: { [accountName]: adapterName },
    elementsSource: elementSource.createInMemoryElementSource(resolvedElements),
    ignoreStateElemIdMapping,
    ignoreStateElemIdMappingForSelectors,
    adapterCreators,
  })
  const adapterContext = adaptersCreatorConfigs[accountName]
  return { adapter, adapterContext, resolvedElements }
}

type IsInitializedFolderArgs = {
  baseDir: string
  adapterName: string
  adapterCreators?: Record<string, Adapter>
}

export type IsInitializedFolderResult = {
  result: boolean
  errors: ReadonlyArray<SaltoError>
}

export const isInitializedFolder = async ({
  baseDir,
  adapterName,
  adapterCreators,
}: IsInitializedFolderArgs): Promise<IsInitializedFolderResult> => {
  // for backward compatibility
  const actualAdapterCreator = adapterCreators ?? allAdapterCreators
  const adapter = actualAdapterCreator[adapterName]
  if (adapter.adapterFormat?.isInitializedFolder === undefined) {
    return {
      result: false,
      errors: [
        {
          severity: 'Error' as const,
          message: 'Format not supported',
          detailedMessage: `Adapter ${adapterName} does not support checking a non-nacl format folder`,
        },
      ],
    }
  }

  return adapter.adapterFormat.isInitializedFolder({ baseDir })
}

type InitFolderArgs = {
  baseDir: string
  adapterName: string
  adapterCreators?: Record<string, Adapter>
}

export type InitFolderResult = {
  errors: ReadonlyArray<SaltoError>
}

export const initFolder = async ({
  baseDir,
  adapterName,
  adapterCreators,
}: InitFolderArgs): Promise<InitFolderResult> => {
  // for backward compatibility
  const actualAdapterCreator = adapterCreators ?? allAdapterCreators
  const adapter = actualAdapterCreator[adapterName]
  const adapterInitFolder = adapter.adapterFormat?.initFolder
  if (adapterInitFolder === undefined) {
    return {
      errors: [
        {
          severity: 'Error' as const,
          message: 'Format not supported',
          detailedMessage: `Adapter ${adapterName} does not support initializing a non-nacl format folder`,
        },
      ],
    }
  }

  return adapterInitFolder({ baseDir })
}

const loadElementsAndMerge = (
  dir: string,
  loadElementsFromFolder: NonNullable<AdapterFormat['loadElementsFromFolder']>,
  adapterContext: AdapterOperationsContext,
): Promise<{
  elements: Element[]
  loadErrors?: SaltoError[]
  mergeErrors: MergeErrorWithElements[]
  mergedElements: Element[]
}> =>
  log.time(
    async () => {
      const { elements, errors } = await loadElementsFromFolder({ baseDir: dir, ...adapterContext })
      const mergeResult = await merger.mergeElements(awu(elements))
      return {
        elements,
        loadErrors: errors,
        mergeErrors: await awu(mergeResult.errors.values()).flat().toArray(),
        mergedElements: await awu(mergeResult.merged.values()).toArray(),
      }
    },
    'loadElementsAndMerge from dir %s',
    dir,
  )

// This is a naive approach, for a more complete implementations see workspace.filterOutHiddenChanges.
// This is good enough for now since hidden value (etc.) changes will not affect adapter format (as far as we can tell).
// For mixed mode, we need to partition on the hidden elements test and add all the hidden changes to the unapplied changes.
const filterHiddenChanges = async (
  changes: ReadonlyArray<Change>,
  elementsSource: ReadOnlyElementsSource,
): Promise<ReadonlyArray<Change>> =>
  awu(changes)
    .filter(async change => !(await hiddenValues.isHidden(getChangeData(change), elementsSource)))
    .toArray()

const resolveChanges = async (
  changes: ReadonlyArray<Change>,
  elementsSource: ReadOnlyElementsSource,
): Promise<ReadonlyArray<Change>> => {
  const beforeElements: ChangeDataType[] = []
  const afterElements: ChangeDataType[] = []

  changes.forEach(change => {
    if (change.action !== 'add') {
      beforeElements.push(change.data.before)
    }
    if (change.action !== 'remove') {
      afterElements.push(change.data.after)
    }
  })

  const resolvedBeforeElements = _.keyBy(await expressions.resolve(beforeElements, elementsSource), element =>
    element.elemID.getFullName(),
  ) as Record<string, ChangeDataType>
  const resolvedAfterElements = _.keyBy(await expressions.resolve(afterElements, elementsSource), element =>
    element.elemID.getFullName(),
  ) as Record<string, ChangeDataType>

  return changes.map(change => {
    if (isAdditionChange(change)) {
      return toChange({
        after: resolvedAfterElements[change.data.after.elemID.getFullName()],
      })
    }
    if (isModificationChange(change)) {
      return toChange({
        before: resolvedBeforeElements[change.data.before.elemID.getFullName()],
        after: resolvedAfterElements[change.data.after.elemID.getFullName()],
      })
    }
    return toChange({
      before: resolvedBeforeElements[change.data.before.elemID.getFullName()],
    })
  })
}

type CalculatePatchArgs = {
  fromDir: string
  toDir: string
} & Omit<GetAdapterAndContextArgs, 'adapterCreators'> & {
    adapterCreators?: Record<string, Adapter>
  }

export const calculatePatch = async ({
  workspace,
  fromDir,
  toDir,
  accountName,
  ignoreStateElemIdMapping,
  ignoreStateElemIdMappingForSelectors,
  adapterCreators,
}: CalculatePatchArgs): Promise<FetchResult> => {
  // for backward compatibility
  const actualAdapterCreator = adapterCreators ?? allAdapterCreators
  const { adapter, adapterContext } = await getAdapterAndContext({
    workspace,
    accountName,
    ignoreStateElemIdMapping,
    ignoreStateElemIdMappingForSelectors,
    adapterCreators: actualAdapterCreator,
  })
  const loadElementsFromFolder = adapter.adapterFormat?.loadElementsFromFolder
  if (loadElementsFromFolder === undefined) {
    throw new Error(`Account ${accountName}'s adapter does not support loading a non-nacl format`)
  }

  const {
    loadErrors: beforeLoadErrors,
    mergeErrors: beforeMergeErrors,
    mergedElements: mergedBeforeElements,
  } = await loadElementsAndMerge(fromDir, loadElementsFromFolder, adapterContext)
  const partiallyFetchedAccounts = new Set([accountName])
  if (beforeMergeErrors.length > 0) {
    return {
      changes: [],
      mergeErrors: beforeMergeErrors,
      fetchErrors: [],
      success: false,
      updatedConfig: {},
      partiallyFetchedAccounts,
    }
  }
  const {
    elements: afterElements,
    loadErrors: afterLoadErrors,
    mergeErrors: afterMergeErrors,
    mergedElements: mergedAfterElements,
  } = await loadElementsAndMerge(toDir, loadElementsFromFolder, adapterContext)
  if (afterMergeErrors.length > 0) {
    return {
      changes: [],
      mergeErrors: afterMergeErrors,
      fetchErrors: [],
      success: false,
      updatedConfig: {},
      partiallyFetchedAccounts,
    }
  }
  const { changes } = await calcFetchChanges({
    accountElements: afterElements,
    mergedAccountElements: mergedAfterElements,
    stateElements: elementSource.createInMemoryElementSource(mergedBeforeElements),
    workspaceElements: await workspace.elements(false),
    partiallyFetchedAccounts: new Map([[accountName, {}]]),
    allFetchedAccounts: new Set([accountName]),
  })
  return {
    changes,
    mergeErrors: [],
    fetchErrors: [...(beforeLoadErrors ?? []), ...(afterLoadErrors ?? [])],
    success: true,
    updatedConfig: {},
    partiallyFetchedAccounts,
  }
}

type SyncWorkspaceToFolderArgs = {
  baseDir: string
} & Omit<GetAdapterAndContextArgs, 'adapterCreators'> & {
    adapterCreators?: Record<string, Adapter>
  }

export type SyncWorkspaceToFolderResult = {
  errors: ReadonlyArray<SaltoError>
}

export const syncWorkspaceToFolder = ({
  workspace,
  accountName,
  baseDir,
  ignoreStateElemIdMapping,
  ignoreStateElemIdMappingForSelectors,
  adapterCreators,
}: SyncWorkspaceToFolderArgs): Promise<SyncWorkspaceToFolderResult> =>
  log.time(
    async () => {
      // for backward compatibility
      const actualAdapterCreator = adapterCreators ?? allAdapterCreators
      const {
        resolvedElements: workspaceElements,
        adapter,
        adapterContext,
      } = await getAdapterAndContext({
        workspace,
        accountName,
        ignoreStateElemIdMapping,
        ignoreStateElemIdMappingForSelectors,
        adapterCreators: actualAdapterCreator,
      })
      const loadElementsFromFolder = adapter.adapterFormat?.loadElementsFromFolder
      const dumpElementsToFolder = adapter.adapterFormat?.dumpElementsToFolder
      if (loadElementsFromFolder === undefined) {
        return {
          errors: [
            {
              severity: 'Error' as const,
              message: 'Format not supported',
              detailedMessage: `Account ${accountName}'s adapter does not support loading a non-nacl format`,
            },
          ],
        }
      }
      if (dumpElementsToFolder === undefined) {
        return {
          errors: [
            {
              severity: 'Error' as const,
              message: 'Format not supported',
              detailedMessage: `Account ${accountName}'s adapter does not support writing a non-nacl format`,
            },
          ],
        }
      }

      const {
        mergedElements: folderElements,
        mergeErrors,
        loadErrors,
      } = await loadElementsAndMerge(baseDir, loadElementsFromFolder, adapterContext)
      if (!_.isEmpty(loadErrors) || !_.isEmpty(mergeErrors)) {
        return {
          errors: makeArray(loadErrors).concat(mergeErrors.map(mergeError => mergeError.error)),
        }
      }

      // We know this is not accurate - we will get false modify changes here because we are directly comparing
      // salto elements to folder elements and we know salto elements have more information in them.
      // This should hopefully be ok because the effect of this incorrect comparison is that we will potentially
      // re-dump elements that are equal, so even though we do redundant work, the end result should be correct
      const plan = await getPlan({
        before: elementSource.createInMemoryElementSource(folderElements),
        after: elementSource.createInMemoryElementSource(workspaceElements),
        dependencyChangers: [],
      })
      const changes = Array.from(plan.itemsByEvalOrder()).flatMap(item => Array.from(item.changes()))
      const changeCounts = _.countBy(changes, change => change.action)

      log.debug(
        'Loaded %d elements from folder %s and %d elements from workspace, applying %d changes (%o) to folder',
        folderElements.length,
        baseDir,
        workspaceElements.length,
        changes.length,
        changeCounts,
      )
      return dumpElementsToFolder({
        baseDir,
        changes: await filterHiddenChanges(changes, adapterContext.elementsSource),
        elementsSource: adapterContext.elementsSource,
      })
    },
    'syncWorkspaceToFolder %s',
    baseDir,
  )

type UpdateElementFolderArgs = {
  workspace: Workspace
  baseDir: string
  accountName: string
  changes: ReadonlyArray<Change>
  adapterCreators?: Record<string, Adapter>
}

export type UpdateElementFolderResult = {
  unappliedChanges: ReadonlyArray<Change>
  errors: ReadonlyArray<SaltoError>
}

export const updateElementFolder = ({
  workspace,
  baseDir,
  changes,
  accountName,
  adapterCreators,
}: UpdateElementFolderArgs): Promise<UpdateElementFolderResult> =>
  log.time(
    async () => {
      // for backward compatibility
      const actualAdapterCreator = adapterCreators ?? allAdapterCreators
      const { adapter, adapterContext } = await getAdapterAndContext({
        workspace,
        accountName,
        adapterCreators: actualAdapterCreator,
      })
      const dumpElementsToFolder = adapter.adapterFormat?.dumpElementsToFolder
      if (dumpElementsToFolder === undefined) {
        return {
          unappliedChanges: [],
          errors: [
            {
              severity: 'Error' as const,
              message: 'Format not supported',
              detailedMessage: `Account ${accountName}'s adapter does not support writing a non-nacl format`,
            },
          ],
        }
      }
      return dumpElementsToFolder({
        baseDir,
        changes: await filterHiddenChanges(
          await resolveChanges(changes, adapterContext.elementsSource),
          adapterContext.elementsSource,
        ),
        elementsSource: adapterContext.elementsSource,
      })
    },
    'updateElementFolder %s',
    baseDir,
  )
