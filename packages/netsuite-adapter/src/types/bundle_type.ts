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

import { BuiltinTypes, ElemID, ObjectType } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { TypeAndInnerTypes } from './object_types'
import { BUNDLE, NETSUITE, TYPES_PATH } from '../constants'

type BundleInstalledBy = {
  id?: number
  name?: string
}

type BundlePublisher = {
  id?: string
  name?: string
}

export type SuiteAppBundleType = {
  id: string
  name?: string
  version?: string
  description?: string
  installedFrom?: string
  isManaged?: boolean
  dateInstalled?: string
  dateLastUpdated?: string
  publisher?: BundlePublisher
  installedBy?: BundleInstalledBy
}

type BundleType = SuiteAppBundleType & { isPrivate?: boolean }

export const bundleType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const bundleElemID = new ElemID(NETSUITE, BUNDLE)
  const BundleInstalledByElemID = new ElemID(NETSUITE, 'bundle_installedby')
  const BundlePublisherElemID = new ElemID(NETSUITE, 'bundle_publisher')

  const bundleInstalledBy = createMatchingObjectType<BundleInstalledBy>({
    elemID: BundleInstalledByElemID,
    annotations: {},
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      name: { refType: BuiltinTypes.STRING },
    },
    path: [NETSUITE, TYPES_PATH, bundleElemID.name],
  })

  const bundlePublisher = createMatchingObjectType<BundlePublisher>({
    elemID: BundlePublisherElemID,
    annotations: {},
    fields: {
      id: { refType: BuiltinTypes.STRING },
      name: { refType: BuiltinTypes.STRING },
    },
    path: [NETSUITE, TYPES_PATH, bundleElemID.name],
  })

  innerTypes.bundleInstalledBy = bundleInstalledBy
  innerTypes.bundlePublisher = bundlePublisher

  const bundle = createMatchingObjectType<BundleType>({
    elemID: bundleElemID,
    annotations: {},
    fields: {
      id: {
        refType: BuiltinTypes.SERVICE_ID,
        annotations: {
          _required: true,
        },
      },
      isPrivate: { refType: BuiltinTypes.BOOLEAN },
      name: { refType: BuiltinTypes.STRING },
      version: { refType: BuiltinTypes.STRING },
      description: { refType: BuiltinTypes.STRING },
      installedFrom: { refType: BuiltinTypes.STRING },
      isManaged: { refType: BuiltinTypes.BOOLEAN },
      dateInstalled: { refType: BuiltinTypes.STRING },
      dateLastUpdated: { refType: BuiltinTypes.STRING },
      publisher: { refType: bundlePublisher },
      installedBy: { refType: bundleInstalledBy },
    },
    path: [NETSUITE, TYPES_PATH, bundleElemID.name],
  })
  return { type: bundle, innerTypes }
}
