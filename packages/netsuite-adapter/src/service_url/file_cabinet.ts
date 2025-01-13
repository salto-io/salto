/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { isFileCabinetInstance, isFileInstance } from '../types'
import { setElementsUrls } from './elements_urls'
import { ServiceUrlSetter } from './types'

const generateUrl = (id: number, element: InstanceElement): string | undefined =>
  isFileInstance(element) ? `app/common/media/mediaitem.nl?id=${id}` : `app/common/media/mediaitemfolder.nl?id=${id}`

const setServiceUrl: ServiceUrlSetter = (elements, client) => {
  setElementsUrls({
    elements: elements.filter(isInstanceElement),
    client,
    filter: isFileCabinetInstance,
    generateUrl,
  })
}

export default setServiceUrl
