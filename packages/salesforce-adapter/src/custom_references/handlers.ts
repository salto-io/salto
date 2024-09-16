/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { FixElementsFunc, InstanceElement, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { combineCustomReferenceGetters, combineElementFixers } from '@salto-io/adapter-components'
import {
  CustomReferencesHandlers,
  CustomReferencesSettings,
  CUSTOM_REFS_CONFIG,
  FixElementsSettings,
  FIX_ELEMENTS_CONFIG,
  SalesforceConfig,
  WeakReferencesHandler,
} from '../types'
import { profilesAndPermissionSetsHandler } from './profiles_and_permission_sets'
import { managedElementsHandler } from './managed_elements'
import { formulaRefsHandler } from './formula_refs'

const handlers: Record<CustomReferencesHandlers, WeakReferencesHandler> = {
  profilesAndPermissionSets: profilesAndPermissionSetsHandler,
  managedElements: managedElementsHandler,
  formulaRefs: formulaRefsHandler,
}

const defaultCustomReferencesConfiguration: Required<CustomReferencesSettings> = {
  profilesAndPermissionSets: true,
  managedElements: true,
  formulaRefs: false,
}

const defaultFixElementsConfiguration: Required<FixElementsSettings> = {
  profilesAndPermissionSets: false,
  managedElements: true,
  formulaRefs: false,
}

export const customReferencesConfiguration = (
  customReferencesConfig: CustomReferencesSettings | undefined,
): Required<CustomReferencesSettings> => _.defaults(customReferencesConfig, defaultCustomReferencesConfiguration)

export const getCustomReferences = combineCustomReferenceGetters(
  _.mapValues(handlers, handler => handler.findWeakReferences),
  (adapterConfig: InstanceElement) => customReferencesConfiguration(adapterConfig.value[CUSTOM_REFS_CONFIG]),
)

const fixElementsConfiguration = (config: SalesforceConfig): Required<FixElementsSettings> =>
  _.defaults(config[FIX_ELEMENTS_CONFIG], defaultFixElementsConfiguration)

export const fixElementsFunc = ({
  elementsSource,
  config,
}: {
  elementsSource: ReadOnlyElementsSource
  config: SalesforceConfig
}): FixElementsFunc =>
  combineElementFixers(
    _.mapValues(handlers, handler => handler.removeWeakReferences({ elementsSource, config })),
    fixElementsConfiguration(config),
  )
