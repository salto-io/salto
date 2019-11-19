import _ from 'lodash'
import {
  Element, isObjectType, ElemID, findInstances, InstanceElement,
} from 'adapter-api'
import { apiName, bpCase } from '../transformer'
import { FilterCreator } from '../filter'
import { SALESFORCE } from '../constants'

export const LAYOUT_TYPE_ID = new ElemID(SALESFORCE, 'layout')
export const LAYOUT_ANNOTATION = 'layouts'
export const LAYOUT_SUFFIX = 'layout'

const MIN_NAME_LENGTH = 4

// Layout full name starts with related sobject and then '-'
const layoutObj = (layout: InstanceElement): string => apiName(layout).split('-')[0]
const fullName = (elem: Element): string => elem.elemID.getFullName()

const fixNames = (layouts: InstanceElement[]): void => {
  const name = (elem: Element): string => elem.elemID.name
  let names = layouts.map(fullName)

  const updateElemID = (layout: InstanceElement, newName: string): void => {
    if (newName.length < MIN_NAME_LENGTH) {
      return
    }
    const newId = layout.type.elemID.createNestedID('instance', newName)
    if (!names.includes(newId.getFullName())) {
      names = _.without(names, fullName(layout))
      names.push(newId.getFullName())
      layout.elemID = newId
    }
  }

  layouts.forEach(l => {
    if (name(l).endsWith(LAYOUT_SUFFIX)) {
      updateElemID(l, _.trimEnd(name(l).slice(0, -1 * LAYOUT_SUFFIX.length), '_'))
    }
    const objName = bpCase(layoutObj(l))
    if (name(l).startsWith(objName)) {
      updateElemID(l, _.trimStart(name(l).slice(objName.length), '_'))
    }
    if (l.path) {
      l.path = [...l.path.slice(0, -1), name(l)]
    }
  })
}

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
    const layouts = [...findInstances(elements, LAYOUT_TYPE_ID)]
    fixNames(layouts)

    const obj2layout = _(layouts)
      .groupBy(layoutObj)
      .value()

    elements
      .filter(isObjectType)
      .forEach(obj => {
        const objLayouts = obj2layout[apiName(obj)]
        if (objLayouts) {
          obj.annotate({ [LAYOUT_ANNOTATION]: objLayouts.map(fullName).sort() })
        }
      })
  },
})

export default filterCreator
