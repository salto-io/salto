/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { createReorderFilterCreator } from './creator'

export const TYPE_NAME = 'workspace'

/**
 * Add workspace order element with all the workspaces ordered
 */
const filterCreator = createReorderFilterCreator({
  filterName: 'workspaceOrderFilter',
  typeName: TYPE_NAME,
  orderFieldName: 'ids',
  activeFieldName: 'activated',
})

export default filterCreator
