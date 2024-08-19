/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, Values, Element } from '@salto-io/adapter-api'
import { createReference } from '../../../utils'
import { JIRA } from '../../../../src/constants'

export const createObjectTypeAttributeValues = (name: string, allElements: Element[]): Values => ({
  name,
  objectType: createReference(new ElemID(JIRA, 'ObjectType', 'instance', 'testSchema_Hardware_Assets@us'), allElements),
  type: 7,
  editable: true,
  sortable: true,
  summable: false,
  indexed: true,
  minimumCardinality: 0,
  maximumCardinality: 1,
  removable: true,
  hidden: false,
  includeChildObjectTypes: false,
  uniqueAttribute: false,
  options: '',
  defaultTypeId: -1,
  typeValueMulti: [
    createReference(new ElemID(JIRA, 'ObjectSchemaStatus', 'instance', 'testSchema__Disposed'), allElements),
    createReference(new ElemID(JIRA, 'ObjectSchemaStatus', 'instance', 'testSchema__Missing'), allElements),
  ],
})
