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
import {
  CustomReferencesHandlers,
  CustomReferencesSettings,
  CUSTOM_REFS_CONFIG,
  FIX_ELEMENTS_CONFIG,
  SalesforceConfig,
  WeakReferencesHandler,
} from '../types'
import { profilesHandler } from './profiles'
import { managedElementsHandler } from './managed_elements'
import { permissionSetsHandler } from './permission_sets'

const handlers: Record<CustomReferencesHandlers, WeakReferencesHandler> = {
  profiles: profilesHandler,
  managedElements: managedElementsHandler,
  permisisonSets: permissionSetsHandler,
}

const defaultHandlersConfiguration: Record<CustomReferencesHandlers, boolean> =
  {
    profiles: false,
    managedElements: true,
    permisisonSets: true,
  }

export const customReferencesConfiguration = (
  customReferencesConfig: CustomReferencesSettings | undefined,
): Record<string, boolean> =>
  _.defaults(customReferencesConfig, defaultHandlersConfiguration)

export const getCustomReferences = combineCustomReferenceGetters(
  _.mapValues(handlers, (handler) => handler.findWeakReferences),
  (adapterConfig: InstanceElement) =>
    customReferencesConfiguration(adapterConfig.value[CUSTOM_REFS_CONFIG]),
)

const fixElementsConfiguration = (
  config: SalesforceConfig,
): Record<string, boolean> =>
  _.defaults(config[FIX_ELEMENTS_CONFIG], defaultHandlersConfiguration)

export const fixElementsFunc = ({
  elementsSource,
  config,
}: {
  elementsSource: ReadOnlyElementsSource
  config: SalesforceConfig
}): FixElementsFunc =>
  combineElementFixers(
    _.mapValues(handlers, (handler) =>
      handler.removeWeakReferences({ elementsSource }),
    ),
    fixElementsConfiguration(config),
  )
