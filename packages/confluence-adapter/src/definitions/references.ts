/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions, references as referenceUtils } from '@salto-io/adapter-components'
import {
  GROUP_TYPE_NAME,
  LABEL_TYPE_NAME,
  PAGE_TYPE_NAME,
  PERMISSION_TYPE_NAME,
  SPACE_TYPE_NAME,
  TEMPLATE_TYPE_NAMES,
} from '../constants'

const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<never>[] = [
  {
    src: { field: 'spaceId' },
    serializationStrategy: 'id',
    target: { type: SPACE_TYPE_NAME },
    sourceTransformation: 'asString',
  },
  {
    src: { field: 'parentId', parentTypes: [PAGE_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: PAGE_TYPE_NAME },
  },
  // This rule should be defined before the same rule with serializationStrategy = 'id'
  {
    src: { field: 'labels', parentTypes: TEMPLATE_TYPE_NAMES },
    serializationStrategy: 'fullValue',
    target: { type: LABEL_TYPE_NAME },
  },
  {
    src: { field: 'labels', parentTypes: TEMPLATE_TYPE_NAMES },
    serializationStrategy: 'id',
    target: { type: LABEL_TYPE_NAME },
  },
  {
    src: { field: 'homepageId', parentTypes: [SPACE_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: PAGE_TYPE_NAME },
  },
  {
    src: { field: 'principalId', parentTypes: [PERMISSION_TYPE_NAME] },
    serializationStrategy: 'id',
    target: { type: GROUP_TYPE_NAME },
  },
]

export const REFERENCES: definitions.ApiDefinitions['references'] = {
  rules: REFERENCE_RULES,
}
