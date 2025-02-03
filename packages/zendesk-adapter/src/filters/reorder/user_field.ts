/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { USER_FIELD_TYPE_NAME } from '../../constants'
import { createReorderFilterCreator } from './creator'

const TYPE_NAME = USER_FIELD_TYPE_NAME

/**
 * Add user field order element with all the user fields ordered
 */
const filterCreator = createReorderFilterCreator({
  filterName: 'userFieldOrderFilter',
  typeName: TYPE_NAME,
  orderFieldName: 'user_field_ids',
  activeFieldName: 'active',
})

export default filterCreator
