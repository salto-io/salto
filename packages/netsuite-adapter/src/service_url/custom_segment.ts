/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isInstanceElement } from '@salto-io/adapter-api'
import { CUSTOM_SEGMENT } from '../constants'
import { setElementsUrls } from './elements_urls'
import { ServiceUrlSetter } from './types'

const setServiceUrl: ServiceUrlSetter = (elements, client) => {
  setElementsUrls({
    elements,
    client,
    filter: element => isInstanceElement(element) && element.elemID.typeName === CUSTOM_SEGMENT,
    generateUrl: id => `app/common/custom/segments/segment.nl?id=${id}`,
  })
}

export default setServiceUrl
