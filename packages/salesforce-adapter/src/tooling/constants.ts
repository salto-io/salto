/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { SALESFORCE, TYPES_PATH } from '../constants'

const TOOLING_FOLDER_NAME = 'Tooling'
export const TOOLING_PATH = [SALESFORCE, TYPES_PATH, TOOLING_FOLDER_NAME] as const
export const TOOLING_MAX_QUERY_LIMIT = 200

export const SupportedToolingObject = {
  InstalledSubscriberPackage: 'InstalledSubscriberPackage',
  SubscriberPackage: 'SubscriberPackage',
} as const

export const ToolingObjectAnnotation = {
  isToolingObject: 'isToolingObject',
} as const

export const ToolingObjectInfo = {
  InstalledSubscriberPackage: {
    Field: {
      SubscriberPackageId: 'SubscriberPackageId',
    },
  },
  SubscriberPackage: {
    Field: {
      Name: 'Name',
      NamespacePrefix: 'NamespacePrefix',
    },
  },
} as const
