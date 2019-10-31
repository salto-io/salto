
import _ from 'lodash'
import {
  Element, isInstanceElement, isObjectType,
} from 'adapter-api'
import { apiName } from '../transformer'
import { FilterCreator } from '../filter'

export const LAYOUT_TYPE_NAME = 'layout'
export const LAYOUT_ANNOTATION = 'layouts'

/**
* Declare the layout filter, this filter adds reference from the sobject to it's layouts.
*/
const filterCreator: FilterCreator = () => ({
  /**
   * Upon fetch, add layout annotations to relevant sobjects.
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const layouts = _(elements)
      .filter(isInstanceElement)
      .filter(e => e.type.elemID.name === LAYOUT_TYPE_NAME)
      // Layout full name starts with related sobject and then '-'
      .groupBy(e => apiName(e).split('-')[0])
      .value()

    elements
      .filter(isObjectType)
      .forEach(obj => {
        const objLayouts = layouts[apiName(obj)]
        if (objLayouts) {
          obj.annotate({ [LAYOUT_ANNOTATION]: objLayouts.map(l => l.elemID.getFullName()).sort() })
        }
      })
  },
})

export default filterCreator
