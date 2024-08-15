/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { createReorderFilterCreator } from './creator'
import { ORG_FIELD_TYPE_NAME } from '../../constants'

/**
 * Add organization field order element with all the organization fields ordered
 */
const filterCreator = createReorderFilterCreator({
  filterName: 'organizationFieldOrderFilter',
  typeName: ORG_FIELD_TYPE_NAME,
  orderFieldName: 'organization_field_ids',
  iterateesToSortBy: [instance => !instance.value.active, instance => instance.value.position],
  activeFieldName: 'active',
})

export default filterCreator
