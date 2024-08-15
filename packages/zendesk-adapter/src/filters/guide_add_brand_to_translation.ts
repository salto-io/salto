/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import {
  ARTICLE_TRANSLATION_TYPE_NAME,
  CATEGORY_TRANSLATION_TYPE_NAME,
  SECTION_TRANSLATION_TYPE_NAME,
} from '../constants'

/**
 * this filter adds brand field to translations since it is created through the standalone mechanism and is not
 * added in its creation.
 */
const filterCreator: FilterCreator = () => ({
  name: 'guideAddBrandToArticleTranslation',
  onFetch: async (elements: Element[]): Promise<void> => {
    elements
      .filter(isInstanceElement)
      .filter(obj =>
        [ARTICLE_TRANSLATION_TYPE_NAME, CATEGORY_TRANSLATION_TYPE_NAME, SECTION_TRANSLATION_TYPE_NAME].includes(
          obj.elemID.typeName,
        ),
      )
      .forEach(elem => {
        elem.value.brand = getParent(elem).value.brand
      })
  },
})
export default filterCreator
