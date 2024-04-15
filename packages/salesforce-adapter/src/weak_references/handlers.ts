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

import _ from 'lodash'
import {
  FixElementsFunc,
  InstanceElement,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import {
  combineCustomReferenceGetters,
  combineElementFixers,
} from '@salto-io/adapter-components'
import { profilesHandler } from './profiles'
import { WeakReferencesHandler } from './types'
import { CUSTOM_REFS_CONFIG, DATA_CONFIGURATION, FETCH_CONFIG } from '../types'

type Handlers = 'profiles'

const handlers: Record<Handlers, WeakReferencesHandler> = {
  profiles: profilesHandler,
}

const defaultHandlersConfiguration: Record<Handlers, boolean> = {
  profiles: false,
}

const handlersConfiguration = (
  adapterConfig: InstanceElement,
): Record<string, boolean> =>
  _.defaults(
    adapterConfig.value[FETCH_CONFIG]?.[DATA_CONFIGURATION]?.[
      CUSTOM_REFS_CONFIG
    ],
    defaultHandlersConfiguration,
  )

export const getCustomReferences = combineCustomReferenceGetters(
  _.mapValues(handlers, (handler) => handler.findWeakReferences),
  handlersConfiguration,
)

export const fixElementsFunc = ({
  elementsSource,
}: {
  elementsSource: ReadOnlyElementsSource
}): FixElementsFunc =>
  combineElementFixers(
    Object.values(handlers).map((handler) =>
      handler.removeWeakReferences({ elementsSource }),
    ),
  )
