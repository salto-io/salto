import _ from 'lodash'
import {
  Element, ObjectType, isObjectType, Field, ReferenceExpression, isInstanceElement,
} from 'adapter-api'
import { FilterWith } from '../filter'
import { FIELD_ANNOTATIONS, VALUE_SET_FIELDS } from '../constants'
import { metadataType, isCustomObject } from '../transformers/transformer'

export const GLOBAL_VALUE_SET = 'GlobalValueSet'
export const CUSTOM_VALUE = 'custom_value'
export const MASTER_LABEL = 'master_label'

type GlobalValueSetsLookup = Record<string, ReferenceExpression>

const getValueSetNameToRef = (elements: Element[]): GlobalValueSetsLookup => {
  const globalValueSets = elements
    .filter(isInstanceElement)
    .filter(e => metadataType(e) === GLOBAL_VALUE_SET)
  return _.fromPairs(globalValueSets
    .map(gvs => [
      gvs.value[MASTER_LABEL],
      new ReferenceExpression(gvs.elemID.createNestedID(CUSTOM_VALUE)),
    ]))
}

const addGlobalValueSetRefToObject = (
  object: ObjectType,
  gvsToRef: GlobalValueSetsLookup
): void => {
  const getValueSetName = (field: Field): string | undefined =>
    field.annotations[FIELD_ANNOTATIONS.VALUE_SET]?.[VALUE_SET_FIELDS.VALUE_SET_NAME]

  Object.values(object.fields)
    .filter(f => getValueSetName(f))
    .forEach(f => {
      const valueSetName = getValueSetName(f)
      if (valueSetName && gvsToRef[valueSetName]) {
        f.annotations[FIELD_ANNOTATIONS.VALUE_SET] = gvsToRef[valueSetName]
      }
    })
}

/**
 * Create filter that adds global value set references where needed
 */
const filterCreator = (): FilterWith<'onFetch'> => ({
  /**
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const valueSetNameToRef = getValueSetNameToRef(elements)
    const customObjects = elements.filter(isObjectType).filter(isCustomObject)
    customObjects.forEach(object => addGlobalValueSetRefToObject(object, valueSetNameToRef))
  },
})

export default filterCreator
