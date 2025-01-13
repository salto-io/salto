/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { PLUGIN_IMPLEMENTATION_TYPES, SCRIPT_TYPES } from '../types'
import { ServiceUrlSetter } from './types'
import { SUPPORTED_TYPES } from '../changes_detector/changes_detectors/script'
import { setElementsUrls } from './elements_urls'

const generateUrl = (id: number, element: InstanceElement): string | undefined => {
  if (SCRIPT_TYPES.includes(element.refType.elemID.name)) {
    return `app/common/scripting/script.nl?id=${id}`
  }
  if (PLUGIN_IMPLEMENTATION_TYPES.includes(element.refType.elemID.name)) {
    return `app/common/scripting/plugin.nl?id=${id}`
  }
  return `app/common/scripting/plugintype.nl?scripttype=PLUGINTYPE&id=${id}`
}

const setServiceUrl: ServiceUrlSetter = (elements, client) => {
  setElementsUrls({
    elements: elements.filter(isInstanceElement),
    client,
    filter: element => SUPPORTED_TYPES.includes(element.refType.elemID.name),
    generateUrl,
  })
}

export default setServiceUrl
