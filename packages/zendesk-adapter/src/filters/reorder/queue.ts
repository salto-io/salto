/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { QUEUE_TYPE_NAME } from '../../constants'
import { createReorderFilterCreator } from './creator'

const TYPE_NAME = QUEUE_TYPE_NAME

/**
 * Add sla policy order element with all the sla policies ordered
 */
const filterCreator = createReorderFilterCreator({
  filterName: 'queueOrderFilter',
  typeName: TYPE_NAME,
  orderFieldName: 'queue_ids',
  iterateesToSortBy: [instance => instance.value.order],
})

export default filterCreator
