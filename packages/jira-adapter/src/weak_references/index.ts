/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { InstanceElement } from '@salto-io/adapter-api'
import { combineCustomReferenceGetters } from '@salto-io/adapter-components'
import { CUSTOM_REFERENCES_CONFIG, CustomReferencesHandlers, JiraCustomReferencesConfig } from '../config/config'
import { automationProjectsHandler } from './automation_projects'
import { WeakReferencesHandler } from './weak_references_handler'
import { fieldConfigurationsHandler } from './field_configuration_items'
import { queueFieldsHandler } from './queue_columns'
import { contextProjectsHandler } from './context_projects'
import { fieldContextsHandler } from './field_contexts'

export const customReferenceHandlers: Record<CustomReferencesHandlers, WeakReferencesHandler> = {
  automationProjects: automationProjectsHandler,
  fieldConfigurationsHandler,
  queueFieldsHandler,
  contextProjectsHandler,
  fieldContextsHandler,
}

const defaultCustomReferencesConfig: Required<JiraCustomReferencesConfig> = {
  automationProjects: true,
  fieldConfigurationsHandler: true,
  queueFieldsHandler: true,
  contextProjectsHandler: true,
  fieldContextsHandler: true,
}

const getCustomReferencesConfig = (
  customReferencesConfig?: JiraCustomReferencesConfig,
): Required<JiraCustomReferencesConfig> => _.defaults({}, customReferencesConfig, defaultCustomReferencesConfig)

export const getCustomReferences = combineCustomReferenceGetters(
  _.mapValues(customReferenceHandlers, handler => handler.findWeakReferences),
  (adapterConfig: InstanceElement) => getCustomReferencesConfig(adapterConfig.value[CUSTOM_REFERENCES_CONFIG]),
)
