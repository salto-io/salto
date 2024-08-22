/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { automationProjectsHandler } from './automation_projects'
import { WeakReferencesHandler } from './weak_references_handler'
import { fieldConfigurationsHandler } from './field_configuration_items'
import { queueFieldsHandler } from './queue_columns'

export const weakReferenceHandlers: Record<string, WeakReferencesHandler> = {
  automationProjects: automationProjectsHandler,
  fieldConfigurationsHandler,
  queueFieldsHandler,
}
