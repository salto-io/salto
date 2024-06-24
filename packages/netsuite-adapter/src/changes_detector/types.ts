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
import NetsuiteClient from '../client/client'

export type ChangedObject = {
  type: 'object'
  objectId: string
  time: Date
}

export type ChangedType = {
  type: 'type'
  name: string
}

export type Change = ChangedType | ChangedObject

export type ChangedCustomRecord = {
  typeId: string
  objectId: string
}

export type DateRange = {
  start: Date
  end: Date
  toSuiteQLRange: () => [string, string]
  toSavedSearchRange: () => [string, string]
}

export type TypeChangesDetector = {
  getChanges: (client: NetsuiteClient, dateRange: DateRange) => Promise<Change[]>
  getTypes: () => string[]
}

export type FileCabinetChangesDetector = (client: NetsuiteClient, dateRange: DateRange) => Promise<ChangedObject[]>
