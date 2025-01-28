/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filters } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'

/**
 * Filter creators of all the common filters
 */
const filterCreators: Record<string, FilterCreator> = {
  hideTypes: filters.hideTypesFilterCreator(),
  referencedInstanceNames: filters.referencedInstanceNamesFilterCreator(),
  query: filters.queryFilterCreator({
    typesToKeep: [
      'automation_order',
      'organization_field_order',
      'sla_policy_order',
      'queue_order',
      'ticket_form_order',
      'trigger_order',
      'user_field_order',
      'view_order',
      'workspace_order',
    ],
  }),
  addAlias: filters.addAliasFilterCreator(), // should run after fieldReferencesFilter
  sortLists: filters.sortListsFilterCreator(),
}

export default filterCreators
