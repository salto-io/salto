/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { isInstanceElement } from '@salto-io/adapter-api'
import { SAVED_SEARCH } from '../constants'
import { setElementsUrls } from './elements_urls'
import { ServiceUrlSetter } from './types'

const setServiceUrl: ServiceUrlSetter = (elements, client) => {
  setElementsUrls({
    elements: elements.filter(isInstanceElement),
    client,
    filter: element => element.refType.elemID.name === SAVED_SEARCH,
    generateUrl: id => `app/common/search/search.nl?cu=T&id=${id}`,
  })
}

export default setServiceUrl
