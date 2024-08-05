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
import { Adapter, AdapterOperationsContext, ChangeDataType, Element, SaltoError, toChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { merger, Workspace, ElementSelector, expressions, elementSource } from '@salto-io/workspace'
import { FetchResult } from '../types'
import { adapterCreators } from './adapters'
import { MergeErrorWithElements, getFetchAdapterAndServicesSetup, calcFetchChanges } from './fetch'

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
  loadElementsFromFolder: NonNullable<Adapter['loadElementsFromFolder']>,
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
  const { loadElementsFromFolder } = adapter
  if (loadElementsFromFolder === undefined) {
    throw new Error(`Account ${accountName}'s adapter does not support loading a non-nacl format`)
  }

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
  const { changes } = await calcFetchChanges(
    afterElements,
    mergedAfterElements,
    elementSource.createInMemoryElementSource(mergedBeforeElements),
    await workspace.elements(false),
    new Map([[accountName, {}]]),
    new Set([accountName]),
  )
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
      const { resolvedElements, adapter, adapterContext } = await getAdapterAndContext({
        workspace,
        accountName,
        ignoreStateElemIdMapping,
        ignoreStateElemIdMappingForSelectors,
      })
      const { loadElementsFromFolder, dumpElementsToFolder } = adapter
      if (loadElementsFromFolder === undefined) {
        throw new Error(`Account ${accountName}'s adapter does not support loading a non-nacl format`)
      }
      if (dumpElementsToFolder === undefined) {
        throw new Error(`Account ${accountName}'s adapter does not support writing a non-nacl format`)
      }

      const loadResult = await loadElementsAndMerge(baseDir, loadElementsFromFolder, adapterContext)
      if (!_.isEmpty(loadResult.loadErrors) || !_.isEmpty(loadResult.mergeErrors)) {
        return {
          errors: makeArray(loadResult.loadErrors).concat(loadResult.mergeErrors.map(mergeError => mergeError.error)),
        }
      }

      const workspaceElementIDs = new Set(resolvedElements.map(elem => elem.elemID.getFullName()))

      const deleteChanges = loadResult.elements
        .filter(elem => !workspaceElementIDs.has(elem.elemID.getFullName()))
        .map(elem => toChange({ before: elem as ChangeDataType }))

      const folderElementsByID = _.keyBy(loadResult.elements, elem => elem.elemID.getFullName())

      const changes = deleteChanges.concat(
        resolvedElements.map(elem =>
          toChange({
            before: folderElementsByID[elem.elemID.getFullName()] as ChangeDataType,
            after: elem as ChangeDataType,
          }),
        ),
      )

      log.debug(
        'Loaded %d elements from folder %s and %d elements from workspace, applying %d changes (%d delete, %d modify, %d add) to folder',
        loadResult.elements.length,
        baseDir,
        resolvedElements.length,
        changes.length,
        deleteChanges.length,
        loadResult.elements.length - deleteChanges.length,
        resolvedElements.length - (loadResult.elements.length - deleteChanges.length),
      )
      return dumpElementsToFolder({ baseDir, changes, elementsSource: adapterContext.elementsSource })
    },
    'syncWorkspaceToFolder %s',
    baseDir,
  )
