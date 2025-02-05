/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { referencesRules, JiraFieldReferenceResolver, contextStrategyLookup } from '../reference_mapping'
import { FilterCreator } from '../filter'
import { AUTOMATION_TYPE, FIELD_CONFIGURATION_TYPE_NAME, PROJECT_COMPONENT_TYPE } from '../constants'
import { JiraConfig } from '../config/config'
import { FIELD_TYPE_NAME } from './fields/constants'
import { advancedFieldsReferenceFunc, walkOnAutomations } from './automation/walk_on_automation'
import { addFieldsTemplateReferences } from './fields/reference_to_fields'

/**
 * Convert field values into references, based on predefined rules.
 */

const NO_REFERENCES_TYPES = (): string[] => [PROJECT_COMPONENT_TYPE, FIELD_CONFIGURATION_TYPE_NAME]

const addWalkOnReferences = (elements: Element[], config: JiraConfig): void => {
  if (!config.fetch.walkOnReferences) {
    return
  }
  const instances = elements.filter(isInstanceElement)
  const fieldInstances = instances.filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
  const fieldInstancesById = new Map(
    fieldInstances.map(instance => [instance.value.id, instance] as [string, InstanceElement]),
  )
  walkOnAutomations(
    instances.filter(instance => instance.elemID.typeName === AUTOMATION_TYPE),
    advancedFieldsReferenceFunc(
      addFieldsTemplateReferences(fieldInstancesById, config.fetch.enableMissingReferences ?? true),
    ),
  )
}

const filter: FilterCreator = ({ config }) => ({
  name: 'fieldReferencesFilter',
  onFetch: async elements => {
    addWalkOnReferences(elements, config)

    const fixedDefs = referencesRules.map(def =>
      config.fetch.enableMissingReferences ? def : _.omit(def, 'missingRefStrategy'),
    )
    // Remove once SALTO-6889 is done: ProjectComponents have no references, so don't need to scan them
    const relevantElements = elements
      .filter(isInstanceElement)
      .filter(instance => !NO_REFERENCES_TYPES().includes(instance.elemID.typeName))
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
