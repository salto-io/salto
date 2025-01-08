/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { createReorderFilterCreator, deployFuncCreator } from './creator'
import { VIEW_TYPE_NAME } from '../../constants'

export const ORDER_FIELD_NAME = 'ids'
export const TYPE_NAME = VIEW_TYPE_NAME

/**
 * Add view order element with all the views ordered
 */
const filterCreator = createReorderFilterCreator({
  filterName: 'viewOrderFilter',
  typeName: TYPE_NAME,
  orderFieldName: ORDER_FIELD_NAME,
  iterateesToSortBy: [
    instance => !instance.value.active,
    instance => instance.value.position,
    instance => instance.value.title,
  ],
  deployFunc: deployFuncCreator('views'),
  activeFieldName: 'active',
})

export default filterCreator
