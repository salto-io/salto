
import _ from 'lodash'
import {
  Element, isObjectType, isInstanceElement,
} from 'adapter-api'
import { SaveResult } from 'jsforce-types'
import { METADATA_OBJECT_NAME_FIELD, API_NAME } from '../constants'
import { bpCase } from '../transformer'
import SalesforceClient from '../client/client'

export const LAYOUT_TYPE_NAME = 'layout'
export const LAYOUT_ANNOTATION = 'layouts'
/**
* Add reference from the sobject to it's layout
* @param client SFDC client
* @param sobject the already discoverd elements
*/
const discover = async (_client: SalesforceClient, elements: Element[]): Promise<void> => {
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
}

export const aspect = {
  discover,
  // In the future we will generate empty layout for new custom objects
  add: (_client: SalesforceClient, _elem: Element): Promise<SaveResult[]> =>
    Promise.resolve([]),
  update: (_client: SalesforceClient, _elem1: Element, _elem2: Element):
    Promise<SaveResult[]> => Promise.resolve([]),
  remove: (_client: SalesforceClient, _elem: Element): Promise<SaveResult[]> =>
    Promise.resolve([]),
}
