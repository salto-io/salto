/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Adapter, AdapterFormat, AdapterOperationsContext, Change, Element, SaltoError } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { merger, Workspace, ElementSelector, expressions, elementSource } from '@salto-io/workspace'
import { FetchResult } from '../types'
import { adapterCreators } from './adapters'
import { MergeErrorWithElements, getFetchAdapterAndServicesSetup, calcFetchChanges } from './fetch'
import { getPlan } from './plan'

const log = logger(module)
const { awu } = collections.asynciterable
const { makeArray } = collections.array

type GetAdapterAndContextArgs = {
  workspace: Workspace
  accountName: string
  ignoreStateElemIdMapping?: boolean
  ignoreStateElemIdMappingForSelectors?: ElementSelector[]
}

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
}: GetAdapterAndContextArgs): Promise<GetAdapterAndContextResult> => {
  const adapterName = workspace.getServiceFromAccountName(accountName)
  if (adapterName !== accountName) {
    throw new Error('Account name that is different from the adapter name is not supported')
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
  })
  const adapterContext = adaptersCreatorConfigs[accountName]
  const adapter = adapterCreators[adapterName]
  return { adapter, adapterContext, resolvedElements }
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

type CalculatePatchArgs = {
  fromDir: string
  toDir: string
} & GetAdapterAndContextArgs

export const calculatePatch = async ({
  workspace,
  fromDir,
  toDir,
  accountName,
  ignoreStateElemIdMapping,
  ignoreStateElemIdMappingForSelectors,
}: CalculatePatchArgs): Promise<FetchResult> => {
  const { adapter, adapterContext } = await getAdapterAndContext({
    workspace,
    accountName,
    ignoreStateElemIdMapping,
    ignoreStateElemIdMappingForSelectors,
  })
  if (adapter.adapterFormat === undefined) {
    throw new Error(`Account ${accountName}'s adapter does not support loading a non-nacl format`)
  }
  const { loadElementsFromFolder } = adapter.adapterFormat

  const {
    loadErrors: beforeLoadErrors,
    mergeErrors: beforeMergeErrors,
    mergedElements: mergedBeforeElements,
  } = await loadElementsAndMerge(fromDir, loadElementsFromFolder, adapterContext)
  if (beforeMergeErrors.length > 0) {
    return {
      changes: [],
      mergeErrors: beforeMergeErrors,
      fetchErrors: [],
      success: false,
      updatedConfig: {},
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
  }
}

type SyncWorkspaceToFolderArgs = {
  baseDir: string
} & GetAdapterAndContextArgs

export type SyncWorkspaceToFolderResult = {
  errors: ReadonlyArray<SaltoError>
}
export const syncWorkspaceToFolder = ({
  workspace,
  accountName,
  baseDir,
  ignoreStateElemIdMapping,
  ignoreStateElemIdMappingForSelectors,
}: SyncWorkspaceToFolderArgs): Promise<SyncWorkspaceToFolderResult> =>
  log.time(
    async () => {
      const {
        resolvedElements: workspaceElements,
        adapter,
        adapterContext,
      } = await getAdapterAndContext({
        workspace,
        accountName,
        ignoreStateElemIdMapping,
        ignoreStateElemIdMappingForSelectors,
      })
      if (adapter.adapterFormat === undefined) {
        return {
          errors: [
            {
              severity: 'Error' as const,
              message: 'Format not supported',
              detailedMessage: `Account ${accountName}'s adapter does not support a non-nacl format`,
            },
          ],
        }
      }
      const { loadElementsFromFolder, dumpElementsToFolder } = adapter.adapterFormat

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
      return dumpElementsToFolder({ baseDir, changes, elementsSource: adapterContext.elementsSource })
    },
    'syncWorkspaceToFolder %s',
    baseDir,
  )

type UpdateElementFolderArgs = {
  workspace: Workspace
  baseDir: string
  accountName: string
  changes: ReadonlyArray<Change>
}

export type UpdateElementFolderResult = {
  errors: ReadonlyArray<SaltoError>
}

export const updateElementFolder = ({
  workspace,
  baseDir,
  changes,
  accountName,
}: UpdateElementFolderArgs): Promise<UpdateElementFolderResult> =>
  log.time(
    async () => {
      const { adapter, adapterContext } = await getAdapterAndContext({
        workspace,
        accountName,
      })
      if (adapter.adapterFormat === undefined) {
        return {
          errors: [
            {
              severity: 'Error' as const,
              message: 'Format not supported',
              detailedMessage: `Account ${accountName}'s adapter does not support a non-nacl format`,
            },
          ],
        }
      }
      const { dumpElementsToFolder } = adapter.adapterFormat
      return dumpElementsToFolder({ baseDir, changes, elementsSource: adapterContext.elementsSource })
    },
    'updateElementFolder %s',
    baseDir,
  )
