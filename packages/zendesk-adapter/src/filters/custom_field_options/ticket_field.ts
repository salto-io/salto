/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { createCustomFieldOptionsFilterCreator } from './creator'
import { TICKET_FIELD_TYPE_NAME } from '../../constants'

/**
 * Deploys ticket field and ticket field options
 */
const filterCreator = createCustomFieldOptionsFilterCreator({
  filterName: 'ticketFieldFilter',
  parentTypeName: TICKET_FIELD_TYPE_NAME,
  childTypeName: 'ticket_field__custom_field_options',
})

export default filterCreator
