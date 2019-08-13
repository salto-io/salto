
import _ from 'lodash'
import {
  Element, isObjectType, isInstanceElement,
} from 'adapter-api'
import { SaveResult } from 'jsforce-types'
import { METADATA_OBJECT_NAME_FIELD, API_NAME } from '../constants'
import { bpCase } from '../transformer'
import Filter from './filter'
import SalesforceClient from '../client/client'

export const LAYOUT_TYPE_NAME = 'layout'
export const LAYOUT_ANNOTATION = 'layouts'

/**
* Declare the layout filter, this filter adds reference from the sobject to it's layouts.
*/
export const filter: Filter = {
  /**
   * Upon discover, add layout annotations to relevant sobjects.
   *
   * @param client SFDC client
   * @param sobject the already discoverd elements
   */
  onDiscover: async (_client: SalesforceClient, elements: Element[]): Promise<void> => {
    const sobjects = elements.filter(isObjectType)
    const layouts = _.groupBy(elements.filter(isInstanceElement)
      .filter(e => e.type.elemID.nameParts[0] === LAYOUT_TYPE_NAME),
    // Layout full name starts with related sobject and then '-'
    e => (e.value[bpCase(METADATA_OBJECT_NAME_FIELD)] as string).split('-')[0])

    sobjects.forEach(obj => {
      const objLayouts = layouts[obj.getAnnotationsValues()[API_NAME]]
      if (objLayouts) {
        obj.annotate({ [LAYOUT_ANNOTATION]: objLayouts.map(l => l.elemID.getFullName()) })
      }
    })
  },
  // In the future we will generate empty layout for new custom objects
  onAdd: (_client: SalesforceClient, _elem: Element): Promise<SaveResult[]> =>
    Promise.resolve([]),
  onUpdate: (_client: SalesforceClient, _elem1: Element, _elem2: Element):
    Promise<SaveResult[]> => Promise.resolve([]),
  onRemove: (_client: SalesforceClient, _elem: Element): Promise<SaveResult[]> =>
    Promise.resolve([]),
}
