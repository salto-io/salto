/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { createReorderFilterCreator } from './creator'
import { SLA_POLICY_TYPE_NAME } from '../../constants'

export const TYPE_NAME = SLA_POLICY_TYPE_NAME

/**
 * Add sla policy order element with all the sla policies ordered
 */
const filterCreator = createReorderFilterCreator({
  filterName: 'slaPolicyOrderFilter',
  typeName: TYPE_NAME,
  orderFieldName: 'sla_policy_ids',
})

export default filterCreator
