/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { isObjectType } from '@salto-io/adapter-api'
import { isCustomRecordType } from '../types'
import { setElementsUrls } from './elements_urls'
import { ServiceUrlSetter } from './types'

const setServiceUrl: ServiceUrlSetter = (elements, client) => {
  setElementsUrls({
    elements,
    client,
    filter: element => isObjectType(element) && isCustomRecordType(element),
    generateUrl: id => `app/common/custom/custrecord.nl?id=${id}`,
  })
}

export default setServiceUrl
