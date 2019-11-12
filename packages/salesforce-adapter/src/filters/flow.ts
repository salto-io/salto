
import _ from 'lodash'
import {
  Element, isObjectType, Type, ElemID,
} from 'adapter-api'
import { FilterWith } from '../filter'
import { SALESFORCE } from '../constants'

export const FLOW_METADATA_TYPE_ID = new ElemID(SALESFORCE, 'flow_metadata_value')

/**
 * Create filter that handles flow type/instances corner case.
 */
const filterCreator = (): FilterWith<'onFetch'> => ({
  /**
   * Upon fetch remove restriction values from flow_metadata_value.name.
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    // fix flow_metadata_value - mark restriction values as not enforced, see: SALTO-93
    const flowMetadataValue = _(elements).filter(isObjectType)
      .find(e => e.elemID.getFullName() === FLOW_METADATA_TYPE_ID.getFullName())
    if (flowMetadataValue && flowMetadataValue.fields.name) {
      flowMetadataValue.fields.name.annotations[Type.RESTRICTION] = { [Type.ENFORCE_VALUE]: false }
    }
  },
})

export default filterCreator
