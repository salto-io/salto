/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { promises } from '@salto-io/lowerdash'
import {
  Adapter,
  ElemID,
  ReadOnlyElementsSource,
  PartialFetchTarget,
  PartialFetchTargetWithPath,
} from '@salto-io/adapter-api'
import { createAdapterReplacedID, Workspace } from '@salto-io/workspace'
import { createAdapterElementsSource } from './adapters'

const log = logger(module)
const { mapValuesAsync } = promises.object

export const getAccountPartialFetchTargets = async ({
  account,
  workspace,
  adapterCreators,
}: {
  account: string
  workspace: Workspace
  adapterCreators: Record<string, Adapter>
}): Promise<PartialFetchTargetWithPath[] | undefined> => {
  const adapter = workspace.getServiceFromAccountName(account)
  const accountConfig = await workspace.accountConfig(account)

  const elementsSource = await workspace.elements()
  const adapterElementsSource = createAdapterElementsSource({
    elementsSource,
    account,
    adapter,
  })

  const aliasMap = await workspace.getAliases()

  return log.timeDebug(
    () =>
      adapterCreators[adapter]?.partialFetch?.getAllTargets({
        elementsSource: adapterElementsSource,
        config: accountConfig,
        getAlias: elemId => {
          const accountElemId = adapter === account ? elemId : createAdapterReplacedID(elemId, account)
          return aliasMap.get(accountElemId.getFullName())
        },
      }),
    'partialFetch.getAllTargets for account %s',
    account,
  )
}

const getTargetsForAccountElements = ({
  adapter,
  account,
  accountElemIds,
  elementsSource,
  adapterCreators,
}: {
  adapter: string
  account: string
  accountElemIds: ElemID[]
  elementsSource: ReadOnlyElementsSource
  adapterCreators: Record<string, Adapter>
}): Promise<PartialFetchTarget[]> | undefined => {
  const adapterElemIds =
    adapter === account ? accountElemIds : accountElemIds.map(elemId => createAdapterReplacedID(elemId, adapter))
  const adapterElementsSource = createAdapterElementsSource({ elementsSource, account, adapter })

  return log.timeDebug(
    () =>
      adapterCreators[adapter]?.partialFetch?.getTargetsForElements({
        elemIds: adapterElemIds,
        elementsSource: adapterElementsSource,
      }),
    'partialFetch.getTargetsForElements for %d ids of account %s',
    adapterElemIds.length,
    account,
  )
}

export const getPartialFetchTargetsForElements = async ({
  elemIds,
  workspace,
  adapterCreators,
}: {
  elemIds: ElemID[]
  workspace: Workspace
  adapterCreators: Record<string, Adapter>
}): Promise<Record<string, PartialFetchTarget[] | undefined>> => {
  const elementsSource = await workspace.elements()
  const elemIdsByAccount = _.groupBy(elemIds, id => id.adapter)

  return mapValuesAsync(elemIdsByAccount, async (accountElemIds, account) =>
    getTargetsForAccountElements({
      adapter: workspace.getServiceFromAccountName(account),
      account,
      accountElemIds,
      elementsSource,
      adapterCreators,
    }),
  )
}
