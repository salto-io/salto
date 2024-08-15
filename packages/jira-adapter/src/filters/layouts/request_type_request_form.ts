/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { ISSUE_VIEW_TYPE, REQUEST_FORM_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { fetchRequestTypeDetails } from './layout_service_operations'

const filter: FilterCreator = ({ client, config, fetchQuery, getElemIdFunc }) => ({
  name: 'requestTypeLayoutsFilter',
  onFetch: async elements => {
    await fetchRequestTypeDetails({
      elements,
      client,
      config,
      fetchQuery,
      getElemIdFunc,
      typeName: REQUEST_FORM_TYPE,
    })
    await fetchRequestTypeDetails({
      elements,
      client,
      config,
      fetchQuery,
      getElemIdFunc,
      typeName: ISSUE_VIEW_TYPE,
    })
  },
})

export default filter
