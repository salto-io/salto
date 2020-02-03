import _ from 'lodash'
import {
  isObjectType, ElemID,
} from 'adapter-api'
import { FilterCreator } from '../filter'
import { SALESFORCE } from '../constants'
import { id } from './utils'

const allRemovedFields: {id: ElemID; fields: string[]}[] = [
  {
    id: new ElemID(SALESFORCE, 'Profile'),
    fields: ['tabVisibilities'],
  },
]

export const makeFilter = (
  removedFields: Record<string, string[]>
): FilterCreator => () => ({
  onFetch: async function onFetch(elements) {
    // Remove fields from types
    elements.filter(isObjectType).forEach(elem => {
      const fieldsToRemove = removedFields[id(elem)]
      if (fieldsToRemove !== undefined) {
        fieldsToRemove.forEach(fieldName => { delete elem.fields[fieldName] })
      }
    })
  },
})

export default makeFilter(
  _(allRemovedFields)
    .map(RemovedField => [RemovedField.id.getFullName(), RemovedField.fields])
    .fromPairs()
    .value(),
)
