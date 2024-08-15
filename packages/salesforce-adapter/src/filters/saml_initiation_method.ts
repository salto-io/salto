/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import wu from 'wu'
import { Element, ElemID, getRestriction } from '@salto-io/adapter-api'
import { findObjectType, findInstances } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { SALESFORCE } from '../constants'

export const CANVAS_METADATA_TYPE_ID = new ElemID(SALESFORCE, 'CanvasMetadata')
export const SAML_INIT_METHOD_FIELD_NAME = 'samlInitiationMethod'

/**
 * Declare the assignment rules filter, this filter renames assignment rules instances to match
 * the names in the Salesforce UI
 */
const filterCreator: LocalFilterCreator = () => ({
  name: 'samlInitMethodFilter',
  /**
   * Upon discover, rename assignment rules instances
   *
   * @param elements the already discovered elements
   */
  onFetch: async (elements: Element[]) => {
    const canvasType = findObjectType(elements, CANVAS_METADATA_TYPE_ID)
    const initMethods = canvasType ? canvasType.fields[SAML_INIT_METHOD_FIELD_NAME] : undefined
    const values = initMethods ? getRestriction(initMethods).values : undefined

    wu(findInstances(elements, CANVAS_METADATA_TYPE_ID)).forEach(canvas => {
      const saml = canvas.value[SAML_INIT_METHOD_FIELD_NAME]
      if (saml && values && !values.includes(saml)) {
        canvas.value[SAML_INIT_METHOD_FIELD_NAME] = 'None'
      }
    })
  },
})

export default filterCreator
