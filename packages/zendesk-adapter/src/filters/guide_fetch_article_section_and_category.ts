/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { TRANSLATION_PARENT_TYPE_NAMES, removeNameAndDescription } from './guide_section_and_category'
import { ARTICLE_TYPE_NAME } from '../constants'

export const removeTitleAndBody = (elem: InstanceElement): void => {
  delete elem.value.title
  delete elem.value.body
}

/**
 * This filter works as follows: onFetch it discards the 'name' and 'description' fields for section and category and
 * the 'title and 'body fields in article to avoid data duplication with the default translation. It is separated from
 * guide_section_and_category as the removal needs to happen after the reference expressions
 * are created.
 */
const filterCreator: FilterCreator = () => ({
  name: 'fetchCategorySection',
  onFetch: async (elements: Element[]): Promise<void> => {
    elements
      .filter(isInstanceElement)
      .filter(obj => [...TRANSLATION_PARENT_TYPE_NAMES, ARTICLE_TYPE_NAME].includes(obj.elemID.typeName))
      .forEach(elem =>
        elem.elemID.typeName === ARTICLE_TYPE_NAME ? removeTitleAndBody(elem) : removeNameAndDescription(elem),
      )
  },
})
export default filterCreator
