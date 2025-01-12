/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ORG_FIELD_TYPE_NAME } from '../../constants'
import { createDeployOptionsWithParentCreator } from './deploy_with_parent_creator'

export const ORG_FIELD_OPTION_TYPE_NAME = 'organization_field__custom_field_options'

const filterCreator = createDeployOptionsWithParentCreator({
  filterName: 'organizationFieldFilter',
  parentTypeName: ORG_FIELD_TYPE_NAME,
  childTypeName: ORG_FIELD_OPTION_TYPE_NAME,
})

export default filterCreator
