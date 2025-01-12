/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'

// We don't fetch those type names (except for trigger_definition) by default
// But since we did in the past and we want to be backward compatible, we keep them in the filter
// Can be removed after SALTO-1792
const DEFINITION_TYPE_NAMES = [
  'macro_definition',
  'macros_actions',
  'trigger_definition',
  'sla_policy_definition',
  'routing_attribute_definition',
]

/**
 * Removes the definition instances
 */
const filterCreator: FilterCreator = () => ({
  name: 'removeDefinitionInstancesFilter',
  onFetch: async elements => {
    _.remove(elements, element => isInstanceElement(element) && DEFINITION_TYPE_NAMES.includes(element.elemID.typeName))
  },
})

export default filterCreator
