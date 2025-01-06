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
  EnvConfig,
  adaptersConfigSource,
  Workspace,
  staticFiles,
  configSource as cs,
  getAdapterConfigsPerAccount as getAdapterConfigsPerAccountImplementation,
} from '@salto-io/workspace'
import { logger } from '@salto-io/logging'
import {
  loadLocalWorkspace as localWorkspaceLoad,
  initLocalWorkspace as localInitLocalWorkspace,
} from '@salto-io/local-workspace'
// for backward comptability
import { adapterCreators as allAdapterCreators } from '@salto-io/adapter-creators'

const log = logger(module)

// for backward compatibility - should be deleted!
export const getAdapterConfigsPerAccount = async (
  envs: EnvConfig[],
  adapterCreators?: Record<string, Adapter>,
): Promise<ObjectType[]> => {
  // for backward compatibility
  const actualAdapterCreator = adapterCreators ?? allAdapterCreators
  return getAdapterConfigsPerAccountImplementation(envs, actualAdapterCreator)
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

  return localInitLocalWorkspace({
    baseDir,
    envName,
    stateStaticFilesSource,
    adapterCreators,
  })
}
