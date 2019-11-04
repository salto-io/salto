import _ from 'lodash'
import {
  Element, isInstanceElement, isObjectType, Type,
} from 'adapter-api'
import { FilterWith } from '../filter'

export const CANVAS_METADATA_TYPE_NAME = 'canvas_metadata'
export const SAML_INIT_METHOD_FIELD_NAME = 'saml_initiation_method'

/**
* Declare the assignment rules filter, this filter renames assignment rules instances to match
* the names in the Salesforce UI
*/
const filterCreator = (): FilterWith<'onFetch'> => ({
  /**
   * Upon discover, rename assignment rules instances
   *
   * @param elements the already discoverd elements
   */
  onFetch: async (elements: Element[]) => {
    const canvasType = _(elements)
      .filter(isObjectType)
      .find(e => e.elemID.name === CANVAS_METADATA_TYPE_NAME)
    const initMethods = canvasType ? canvasType.fields[SAML_INIT_METHOD_FIELD_NAME] : undefined
    const values = initMethods ? initMethods.annotations[Type.VALUES] : undefined

    _(elements)
      .filter(isInstanceElement)
      .filter(e => e.type.elemID.name === CANVAS_METADATA_TYPE_NAME)
      .forEach(canvas => {
        const saml = canvas.value[SAML_INIT_METHOD_FIELD_NAME]
        if (saml && values && !values.includes(saml)) {
          canvas.value[SAML_INIT_METHOD_FIELD_NAME] = 'None'
        }
      })
  },
})

export default filterCreator
