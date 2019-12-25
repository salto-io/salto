import wu from 'wu'
import {
  Element, Type, ElemID, findObjectType, findInstances,
} from 'adapter-api'
import { FilterWith } from '../filter'
import { SALESFORCE } from '../constants'

export const CANVAS_METADATA_TYPE_ID = new ElemID(SALESFORCE, 'canvas_metadata')
export const SAML_INIT_METHOD_FIELD_NAME = 'saml_initiation_method'

/**
* Declare the assignment rules filter, this filter renames assignment rules instances to match
* the names in the Salesforce UI
*/
const filterCreator = (): FilterWith<'onFetch'> => ({
  /**
   * Upon discover, rename assignment rules instances
   *
   * @param elements the already discovered elements
   */
  onFetch: async (elements: Element[]) => {
    const canvasType = findObjectType(elements, CANVAS_METADATA_TYPE_ID)
    const initMethods = canvasType ? canvasType.fields[SAML_INIT_METHOD_FIELD_NAME] : undefined
    const values = initMethods ? initMethods.annotations[Type.ANNOTATIONS.VALUES] : undefined

    wu(findInstances(elements, CANVAS_METADATA_TYPE_ID))
      .forEach(canvas => {
        const saml = canvas.value[SAML_INIT_METHOD_FIELD_NAME]
        if (saml && values && !values.includes(saml)) {
          canvas.value[SAML_INIT_METHOD_FIELD_NAME] = 'None'
        }
      })
  },
})

export default filterCreator
