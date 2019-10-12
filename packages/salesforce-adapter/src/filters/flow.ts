
import _ from 'lodash'
import {
  Element, isObjectType, Type,
} from 'adapter-api'
import { FilterWith } from '../filter'

export const FLOW_METADATA_VALUE_TYPE_NAME = 'flow_metadata_value'

/**
 * Create filter that handles flow type/instances corner case.
 */
const filterCreator = (): FilterWith<'onDiscover'> => ({
  /**
   * Upon discover remove restriction values from flow_metadata_value.name.
   *
   * @param elements the already discovered elements
   */
  onDiscover: async (elements: Element[]): Promise<void> => {
    // fix flow_metadata_value - remove resriction values from name, see: SALTO-93
    const flowMetadataValue = _(elements).filter(isObjectType)
      .find(e => e.elemID.name === FLOW_METADATA_VALUE_TYPE_NAME)
    if (flowMetadataValue && flowMetadataValue.fields.name) {
      delete flowMetadataValue.fields.name.annotations[Type.VALUES]
    }
  },
})

export default filterCreator
