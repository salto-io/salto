import _ from 'lodash'
import { logger } from '@salto/logging'
import { collections } from '@salto/lowerdash'
import {
  Element, isObjectType, ElemID, findInstances, InstanceElement, ReferenceExpression,
  INSTANCE_ANNOTATIONS, isReferenceExpression, ObjectType,
} from 'adapter-api'
import { apiName, isCustomObject, bpCase } from '../transformers/transformer'
import { FilterCreator } from '../filter'
import { SALESFORCE } from '../constants'
import { id } from './utils'

export const LAYOUT_TYPE_ID = new ElemID(SALESFORCE, 'Layout')
export const LAYOUT_ANNOTATION = 'layouts'
export const LAYOUT_SUFFIX = ' Layout'

const { makeArray } = collections.array
const log = logger(module)

const MIN_NAME_LENGTH = 4

export const specialLayoutObjects = new Map([
  ['CaseClose', 'Case'],
  ['UserAlt', 'User'],
])

// Layout full name starts with related sobject and then '-'
const layoutObjAndName = (layout: InstanceElement): [string, string] => {
  const [obj, ...name] = apiName(layout).split('-')
  return [specialLayoutObjects.get(obj) ?? obj, name.join('-')]
}

const defaultLayoutName = (layout: InstanceElement): string => bpCase(apiName(layout))

const fixNames = (layouts: InstanceElement[]): void => {
  let names = layouts.map(id)

  const updateElemID = (layout: InstanceElement, newName: string): void => {
    if (newName.length < MIN_NAME_LENGTH) {
      return
    }
    const newId = layout.type.elemID.createNestedID('instance', bpCase(newName))
    if (!names.includes(newId.getFullName())) {
      names = _.without(names, id(layout))
      names.push(newId.getFullName())
      _.set(layout, 'elemID', newId)
    }
  }

  layouts
    .filter(layout => layout.elemID.name === defaultLayoutName(layout))
    .forEach(layout => updateElemID(layout, layoutObjAndName(layout)[1]))
}

const addObjectReference = (layout: InstanceElement, { elemID: objectID }: ObjectType): void => {
  const layoutDeps = makeArray(layout.annotations[INSTANCE_ANNOTATIONS.DEPENDS_ON])
  if (layoutDeps.filter(isReferenceExpression).some(ref => ref.elemId.isEqual(objectID))) {
    return
  }
  layoutDeps.push(new ReferenceExpression(objectID))
  layout.annotations[INSTANCE_ANNOTATIONS.DEPENDS_ON] = layoutDeps
}

const fixLayoutPath = (
  layout: InstanceElement,
  { path: objectPath }: ObjectType,
): void => {
  if (objectPath === undefined) {
    return
  }
  layout.path = [...objectPath.slice(0, -1), layout.elemID.typeName, layout.elemID.name]
}

/**
* Declare the layout filter, this filter adds reference from the sobject to it's layouts.
*/
const filterCreator: FilterCreator = () => ({
  /**
   * Upon fetch, shorten layout ID and add reference to layout sobjects.
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const layouts = [...findInstances(elements, LAYOUT_TYPE_ID)]
    fixNames(layouts)

    const customObjects = new Map(
      elements.filter(isObjectType).filter(isCustomObject).map(obj => [apiName(obj), obj]),
    )

    layouts.forEach(layout => {
      const [layoutObjName, layoutName] = layoutObjAndName(layout)
      const layoutObj = customObjects.get(layoutObjName)
      if (layoutObj === undefined) {
        log.debug('Could not find object %s for layout %s', layoutObjName, layoutName)
        return
      }
      addObjectReference(layout, layoutObj)
      fixLayoutPath(layout, layoutObj)
    })
  },
})

export default filterCreator
