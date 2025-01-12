/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { FilterCreator } from '../filter'
import { getDashboardLayoutsAsync } from './dashboard/dashboard_layout'
import { getDashboardPropertiesAsync } from './dashboard/gadget'
import { getLayoutRequestsAsync } from './layouts/issue_layout'

// Filter to start the async API calls
const filter: FilterCreator = ({ client, config, fetchQuery, adapterContext }) => ({
  name: 'asyncAPICalls',
  onFetch: async elements => {
    adapterContext.layoutsPromise = getLayoutRequestsAsync(client, config, fetchQuery, elements)
    adapterContext.dashboardLayoutPromise = getDashboardLayoutsAsync(client, config, elements)
    adapterContext.dashboardPropertiesPromise = getDashboardPropertiesAsync(client, elements)
  },
})

export default filter
