/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  Adapter,
  ElemID,
  ReadOnlyElementsSource,
  TargetedFetchType,
  TargetedFetchTypeWithPath,
} from '@salto-io/adapter-api'
import { createAdapterReplacedID, Workspace } from '@salto-io/workspace'
import { createAdapterElementsSource } from './adapters'

const log = logger(module)

export const getAccountTargetedFetchTypes = async ({
  account,
  workspace,
  adapterCreators,
}: {
  account: string
  workspace: Workspace
  adapterCreators: Record<string, Adapter>
}): Promise<TargetedFetchTypeWithPath[] | undefined> => {
  const adapter = workspace.getServiceFromAccountName(account)
  const adapterConfig = await workspace.accountConfig(account)

  if (adapterConfig === undefined) {
    log.warn('getAccountTargetedFetchTypes: missing adapter config')
    return undefined
  }

  const elementsSource = await workspace.elements()
  const adapterElementsSource = createAdapterElementsSource({
    elementsSource,
    account,
    adapter,
  })

  const aliasMap = await workspace.getAliases()

  return log.timeDebug(
    () =>
      adapterCreators[adapter].getTargetedFetchTypes?.({
        elementsSource: adapterElementsSource,
        adapterConfig,
        getAlias: elemId => aliasMap.get(createAdapterReplacedID(elemId, account).getFullName()),
      }),
    'getTargetedFetchTypes for account %s',
    account,
  )
}

const getAccountElementsTargetedFetchTypes = ({
  account,
  accountElemIds,
  workspace,
  elementsSource,
  adapterCreators,
}: {
  account: string
  accountElemIds: ElemID[]
  workspace: Workspace
  elementsSource: ReadOnlyElementsSource
  adapterCreators: Record<string, Adapter>
}): Promise<TargetedFetchType[]> | undefined =>
  log.timeDebug(
    () => {
      const adapter = workspace.getServiceFromAccountName(account)
      const adapterElemIds = accountElemIds.map(elemId => createAdapterReplacedID(elemId, adapter))
      const adapterElementsSource = createAdapterElementsSource({ elementsSource, account, adapter })
      return adapterCreators[adapter].getElementsTargetedFetchTypes?.({
        elemIds: adapterElemIds,
        elementsSource: adapterElementsSource,
      })
    },
    'getElementsTargetedFetchTypes for %d ids of account %s',
    accountElemIds.length,
    account,
  )

export const getElementsTargetedFetchTypes = async ({
  elemIds,
  workspace,
  adapterCreators,
}: {
  elemIds: ElemID[]
  workspace: Workspace
  adapterCreators: Record<string, Adapter>
}): Promise<Record<string, TargetedFetchType[] | undefined>> => {
  const elementsSource = await workspace.elements()
  const elemIdsByAccount = _.groupBy(elemIds, id => id.adapter)

  const targetedFetchTypesByAccount = await Promise.all(
    Object.entries(elemIdsByAccount).map(
      async ([account, accountElemIds]) =>
        [
          account,
          await getAccountElementsTargetedFetchTypes({
            account,
            accountElemIds,
            workspace,
            elementsSource,
            adapterCreators,
          }),
        ] as const,
    ),
  )

  return Object.fromEntries(targetedFetchTypesByAccount)
}
