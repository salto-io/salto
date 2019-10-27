import {
  Element, isObjectType, ObjectType,
} from 'adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'

const ADDRESS_CHILD_FIELDS = ['city', 'country', 'geocode_accuracy', 'latitude', 'longitude',
  'postal_code', 'state', 'street', 'country_code', 'state_code']

const NAME_CHILD_FIELDS = ['first_name', 'last_name', 'salutation']

const GEOLOCATION_CHILD_FIELDS = ['latitude_s', 'longitude_s']

// Internal functions
const handleAddressFields = (object: ObjectType): void => {
  // Find the address fields
  const addressFields = _.pickBy(object.fields,
    value => value.type.elemID.name === 'address')

  // For each address field, get its prefix, then find its corresponding child fields by
  // this prefix.
  Object.entries(addressFields).forEach(([key, field]) => {
    const addressPrefix = key.slice(0, -7)
    ADDRESS_CHILD_FIELDS.forEach(childField => {
      const subField = addressPrefix + childField
      // Remove from the main fields of the element
      object.fields = _.omit(object.fields, subField)
    })
  })
}

const handleNameField = (object: ObjectType): void => {
  // Find the name field
  const nameFields = _.pickBy(object.fields,
    (value, key) => key === 'name' && value.annotations.label === 'Full Name')

  if (_.size(nameFields) === 0) {
    return
  }
  NAME_CHILD_FIELDS.forEach(childField => {
    // Remove from the main fields of the element
    object.fields = _.omit(object.fields, childField)
  })
}

const handleGeolocationFields = (object: ObjectType): void => {
  // Find the  geolocation fields
  const locationFields = _.pickBy(object.fields,
    value => value.type.elemID.name === 'location')

  // For each geolocation field, get its name, then find its corresponding child fields by
  // this name.
  Object.entries(locationFields).forEach(([key, _field]) => {
    GEOLOCATION_CHILD_FIELDS.forEach(childField => {
      // Set as the field as child field of the father compund field
      const subField = `${key}_${childField}`
      // Remove from the main fields of the element
      object.fields = _.omit(object.fields, subField)
    })
  })
}

/**
* Declare the compound fields filter, this filter collects all the compound fields'
* sub fields and removes them
*/
const filterCreator: FilterCreator = () => ({
  /**
   * Upon discover, organize the compound fields
   *
   * @param elements the already discovered elements
   */
  onDiscover: async (elements: Element[]): Promise<void> => {
    // Filter the sub elements of the compound fields.
    // We handle the following compound fields: Address, Geolocation and Name (Name not documented)
    // https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/compound_fields.htm
    const objectTypes = elements.filter(isObjectType)
      .filter(elem => Object.values(elem.fields).some(value => value.type.elemID.name === 'address'
      || value.type.elemID.name === 'location'
      // We specifically look for built in fields which have a label "Full Name" because there
      // are also other fields with api name "Name" which are not compound fields that include
      // first and last name like "Full Name".
      || value.annotations.label === 'Full Name'))

    if (objectTypes) {
      // For each element which has compund fields, find the compund fields and then find the
      // fields which should be their child fields, and move them to be their child fields.
      // Handle each type of compund fields separately:
      objectTypes.forEach(object => {
        // 1) Handle the address fields
        handleAddressFields(object)
        // 2) Handle the name field
        handleNameField(object)
        // 3) Handle geolocation fields
        handleGeolocationFields(object)
      })
    }
  },
})

export default filterCreator
