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

// Layout full name starts with related sobject and then '-'
const layoutObj = (layout: InstanceElement): string => apiName(layout).split('-')[0]

const fixNames = (layouts: InstanceElement[]): void => {
  const names = layouts.map(l => l.elemID.getFullName())

  const updateElemID = (layout: InstanceElement, newName: string): void => {
    if (newName.length < 4) {
      return
    }
    const newId = layout.type.elemID.createNestedID('instance', newName)
    if (!names.includes(newId.getFullName())) {
      const pre = names.findIndex(n => n === layout.elemID.getFullName())
      if (pre > -1) {
        names[pre] = newId.getFullName()
      } else {
        names.push(newId.getFullName())
      }
      layout.elemID = newId
    }
  }

  layouts.forEach(l => {
    if (l.elemID.name.endsWith(LAYOUT_SUFFIX)) {
      updateElemID(l, _.trimEnd(l.elemID.name.slice(0, -1 * LAYOUT_SUFFIX.length), '_'))
    }
    const objName = bpCase(layoutObj(l))
    if (l.elemID.name.startsWith(objName)) {
      updateElemID(l, _.trimStart(l.elemID.name.slice(objName.length), '_'))
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
          obj.annotate({ [LAYOUT_ANNOTATION]: objLayouts.map(l => l.elemID.getFullName()).sort() })
        }
      })
  },
})

export default filterCreator
