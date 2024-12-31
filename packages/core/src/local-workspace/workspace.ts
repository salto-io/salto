/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { ObjectType, ReferenceInfo, Element, GLOBAL_ADAPTER, DetailedChange, Adapter } from '@salto-io/adapter-api'
import {
  elementSource,
  EnvConfig,
  adaptersConfigSource,
  createAdapterReplacedID,
  Workspace,
  staticFiles,
  configSource as cs,
} from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  loadLocalWorkspace as localWorkspaceLoad,
  initLocalWorkspace as localInitLocalWorkspace,
  getCustomReferencesImplementation,
} from '@salto-io/local-workspace'
// for backward comptability
import { adapterCreators as allAdapterCreators } from '@salto-io/adapter-creators'
import { getAdaptersConfigTypesMap } from '../core/adapters'

const { awu } = collections.asynciterable
const log = logger(module)

// for backward compatibility - should be deleted!
export const getAdapterConfigsPerAccount = async (
  envs: EnvConfig[],
  adapterCreators?: Record<string, Adapter>,
): Promise<ObjectType[]> => {
  // for backward compatibility
  const actualAdapterCreator = adapterCreators ?? allAdapterCreators
  const configTypesByAccount = getAdaptersConfigTypesMap(actualAdapterCreator)
  const configElementSource = elementSource.createInMemoryElementSource(Object.values(configTypesByAccount).flat())
  const differentlyNamedAccounts = Object.fromEntries(
    envs
      .flatMap(env => Object.entries(env.accountToServiceName ?? {}))
      .filter(([accountName, serviceName]) => accountName !== serviceName),
  )
  await awu(Object.keys(differentlyNamedAccounts)).forEach(async account => {
    const adapter = differentlyNamedAccounts[account]
    const adapterConfigs = configTypesByAccount[adapter]
    const additionalConfigs = await adaptersConfigSource.calculateAdditionalConfigTypes(
      configElementSource,
      adapterConfigs.map(conf => createAdapterReplacedID(conf.elemID, account)),
      adapter,
      account,
    )
    configTypesByAccount[account] = additionalConfigs
  })
  return Object.values(configTypesByAccount).flat()
}

// for backward compatibility - should be deleted!
export const getCustomReferences = async (
  elements: Element[],
  accountToServiceName: Record<string, string>,
  adaptersConfig: adaptersConfigSource.AdaptersConfigSource,
): Promise<ReferenceInfo[]> => {
  const accountElementsToRefs = async ([account, accountElements]: [string, Element[]]): Promise<ReferenceInfo[]> => {
    const serviceName = accountToServiceName[account] ?? account
    try {
      const refFunc = allAdapterCreators[serviceName]?.getCustomReferences
      if (refFunc !== undefined) {
        return await refFunc(accountElements, await adaptersConfig.getAdapter(account))
      }
    } catch (err) {
      log.error('failed to get custom references for %s: %o', account, err)
    }
    return []
  }

  const accountToElements = _.groupBy(
    elements.filter(e => e.elemID.adapter !== GLOBAL_ADAPTER),
    e => e.elemID.adapter,
  )
  return (await Promise.all(Object.entries(accountToElements).map(accountElementsToRefs))).flat()
}

type LoadLocalWorkspaceArgs = {
  path: string
  configOverrides?: DetailedChange[]
  persistent?: boolean
  stateStaticFilesSource?: staticFiles.StateStaticFilesSource
  credentialSource?: cs.ConfigSource
  ignoreFileChanges?: boolean
  adapterCreators?: Record<string, Adapter>
}

export async function loadLocalWorkspace(args: LoadLocalWorkspaceArgs): Promise<Workspace> {
  // for backward compatibility
  const actualAdapterCreator = args.adapterCreators ?? allAdapterCreators
  return localWorkspaceLoad({
    ...args,
    adapterCreators: actualAdapterCreator,
  })
}

type InitLocalWorkspaceParams = {
  baseDir: string
  envName?: string
  stateStaticFilesSource?: staticFiles.StateStaticFilesSource
  adapterCreators: Record<string, Adapter>
}

const getInitLocalWorkspace: (
  baseDirOrParams: string | InitLocalWorkspaceParams,
  envName?: string,
  stateStaticFilesSource?: staticFiles.StateStaticFilesSource,
) => InitLocalWorkspaceParams = (baseDirOrParams, envName, stateStaticFilesSource) => {
  if (!_.isString(baseDirOrParams)) {
    return baseDirOrParams
  }
  return {
    baseDir: baseDirOrParams,
    envName,
    stateStaticFilesSource,
    adapterCreators: allAdapterCreators,
  }
}

// As a transitionary step, we support both a string input and an argument object
export function initLocalWorkspace(args: InitLocalWorkspaceParams): Promise<Workspace>
// @deprecated
export function initLocalWorkspace(
  inputBaseDir: string,
  inputEnvName?: string,
  inputStateStaticFilesSource?: staticFiles.StateStaticFilesSource,
): Promise<Workspace>

export async function initLocalWorkspace(
  inputBaseDir: string | InitLocalWorkspaceParams,
  inputEnvName = 'default',
  inputStateStaticFilesSource?: staticFiles.StateStaticFilesSource,
): Promise<Workspace> {
  // for backward compatibility
  const {
    baseDir,
    envName = 'default',
    stateStaticFilesSource,
    adapterCreators,
  } = getInitLocalWorkspace(inputBaseDir, inputEnvName, inputStateStaticFilesSource)

  return localInitLocalWorkspace(
    baseDir,
    envName,
    Object.values(getAdaptersConfigTypesMap(adapterCreators)).flat(),
    getCustomReferencesImplementation(adapterCreators),
    stateStaticFilesSource,
  )
}
