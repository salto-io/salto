/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  AdapterGroupProperties,
  AuthorInformation,
  Change,
  DetailedChangeWithBaseChange,
  InstanceElement,
  SaltoElementError,
  SaltoError,
} from '@salto-io/adapter-api'
import { MergeErrorWithElements } from './core/fetch'
import { Plan } from './core/plan'

export type FetchChangeMetadata = AuthorInformation
export type FetchChange = {
  // The actual change to apply to the workspace
  change: DetailedChangeWithBaseChange
  // The change that happened in the service
  serviceChanges: DetailedChangeWithBaseChange[]
  // The change between the working copy and the state
  pendingChanges?: DetailedChangeWithBaseChange[]
  // Metadata information about the change.
  metadata?: FetchChangeMetadata
}

export type FetchResult = {
  changes: FetchChange[]
  mergeErrors: MergeErrorWithElements[]
  fetchErrors: SaltoError[]
  success: boolean
  configChanges?: Plan
  updatedConfig: Record<string, InstanceElement[]>
  accountNameToConfigMessage?: Record<string, string>
  partiallyFetchedAccounts: Set<string>
}

export type GroupProperties = AdapterGroupProperties & {
  id: string
  accountName: string
}

export type DeployError = (SaltoError | SaltoElementError) & {
  groupId: string | string[]
}

export interface DeployResult {
  success: boolean
  errors: DeployError[]
  changes?: Iterable<FetchChange>
  appliedChanges?: Change[]
  extraProperties?: {
    groups?: GroupProperties[]
  }
}
