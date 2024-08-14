/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { createReorderFilterCreator } from './creator'
import { TICKET_FORM_TYPE_NAME } from '../../constants'

/**
 * Add ticket forms order element with all the ticket forms ordered
 */
const filterCreator = createReorderFilterCreator({
  filterName: 'ticketFormOrderFilter',
  typeName: TICKET_FORM_TYPE_NAME,
  orderFieldName: 'ticket_form_ids',
  activeFieldName: 'active',
})

export default filterCreator
