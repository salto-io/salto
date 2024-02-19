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
import {
  AdapterGroupProperties,
  AuthorInformation,
  Change,
  DetailedChangeWithBaseChange,
  SaltoElementError,
  SaltoError,
} from '@salto-io/adapter-api'

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
