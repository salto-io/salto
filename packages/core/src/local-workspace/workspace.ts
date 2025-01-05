/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { DetailedChange, Adapter } from '@salto-io/adapter-api'
import { Workspace, staticFiles, configSource as cs } from '@salto-io/workspace'
import {
  loadLocalWorkspace as localWorkspaceLoad,
  initLocalWorkspace as localInitLocalWorkspace,
} from '@salto-io/local-workspace'

type LoadLocalWorkspaceArgs = {
  path: string
  configOverrides?: DetailedChange[]
  persistent?: boolean
  stateStaticFilesSource?: staticFiles.StateStaticFilesSource
  credentialSource?: cs.ConfigSource
  ignoreFileChanges?: boolean
  adapterCreators: Record<string, Adapter>
}

export async function loadLocalWorkspace(args: LoadLocalWorkspaceArgs): Promise<Workspace> {
  return localWorkspaceLoad({
    ...args,
    adapterCreators: args.adapterCreators,
  })
}

type InitLocalWorkspaceParams = {
  baseDir: string
  envName?: string
  stateStaticFilesSource?: staticFiles.StateStaticFilesSource
  adapterCreators: Record<string, Adapter>
}

export async function initLocalWorkspace(args: InitLocalWorkspaceParams): Promise<Workspace> {
  const { baseDir, envName = 'default', stateStaticFilesSource, adapterCreators } = args

  return localInitLocalWorkspace({
    baseDir,
    envName,
    stateStaticFilesSource,
    adapterCreators,
  })
}
