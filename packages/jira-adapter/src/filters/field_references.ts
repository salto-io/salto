/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { referencesRules, JiraFieldReferenceResolver, contextStrategyLookup } from '../reference_mapping'
import { FilterCreator } from '../filter'
import { FIELD_CONFIGURATION_TYPE_NAME, PROJECT_COMPONENT_TYPE } from '../constants'

/**
 * Convert field values into references, based on predefined rules.
 */

const noReferencesTypes = [PROJECT_COMPONENT_TYPE, FIELD_CONFIGURATION_TYPE_NAME]

const filter: FilterCreator = ({ config }) => ({
  name: 'fieldReferencesFilter',
  onFetch: async (elements: Element[]) => {
    const fixedDefs = referencesRules.map(def =>
      config.fetch.enableMissingReferences ? def : _.omit(def, 'missingRefStrategy'),
    )
    // Remove once SALTO-6889 is done: ProjectComponents have no references, so don't need to scan them
    const relevantElements = elements
      .filter(isInstanceElement)
      .filter(instance => !noReferencesTypes.includes(instance.elemID.typeName))
    await referenceUtils.addReferences({
      elements: relevantElements,
      contextElements: elements,
      fieldsToGroupBy: ['id', 'name', 'originalName', 'groupId', 'key'],
      defs: fixedDefs,
      contextStrategyLookup,
      fieldReferenceResolverCreator: defs => new JiraFieldReferenceResolver(defs),
    })
  },
})

export default filter
