import {
  Element, CORE_ANNOTATIONS, ElemID, findObjectType, RESTRICTION_ANNOTATIONS,
} from 'adapter-api'
import { FilterWith } from '../filter'
import { SALESFORCE } from '../constants'

export const FLOW_METADATA_TYPE_ID = new ElemID(SALESFORCE, 'FlowMetadataValue')

/**
 * Create filter that handles flow type/instances corner case.
 */
const filterCreator = (): FilterWith<'onFetch'> => ({
  /**
   * Upon fetch remove restriction values from flowMetadataValue.name.
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    // fix flowMetadataValue - mark restriction values as not enforced, see: SALTO-93
    const flowMetadataValue = findObjectType(elements, FLOW_METADATA_TYPE_ID)
    if (flowMetadataValue && flowMetadataValue.fields.name) {
      flowMetadataValue.fields.name
        .annotations[CORE_ANNOTATIONS.RESTRICTION] = {
          [RESTRICTION_ANNOTATIONS.ENFORCE_VALUE]: false,
        }
    }
  },
})

export default filterCreator
