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

export const createObjectTypeValues = (name: string, allElements: Element[]): Values => ({
  name,
  type: 0,
  inherited: true,
  abstractObjectType: false,
  parentObjectTypeInherited: true,
  iconId: '141',
  parentObjectTypeId: createReference(
    new ElemID(JIRA, 'ObjectType', 'instance', 'testSchema_Hardware_Assets@us'),
    allElements,
  ),
})
