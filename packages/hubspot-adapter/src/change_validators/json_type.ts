import _ from 'lodash'
import { ChangeError, Change, isInstanceElement, Element,
  BuiltinTypes, getChangeElement, isModificationDiff, InstanceElement, isPrimitiveType } from 'adapter-api'

const getJsonValidationErrorsFromAfter = async (after: Element):
  Promise<ReadonlyArray<ChangeError>> => {
  if (!isInstanceElement(after)) {
    return []
  }
  const errors = Object.values(_.pickBy(_.mapValues(after.value, (val, key) => {
    const field = after.type.fields[key]
    const fieldType = field?.type
    if (isPrimitiveType(fieldType) && fieldType.isEqual(BuiltinTypes.JSON)) {
      try {
        JSON.parse(val)
      } catch (error) {
        return {
          elemID: after.elemID,
          severity: 'Error',
          message: `Error parsing the json string in field ${after.elemID.name}.${field.name}`,
          detailedMessage: `Error (${error.message}) parsing the json string in field ${after.elemID.name}.${field.name}`,
        }
      }
    }
    return undefined
  }), v => !_.isUndefined(v))) as ChangeError[]
  return errors
}

export const changeValidator = {
  onAdd: async (after: Element): Promise<ReadonlyArray<ChangeError>> =>
    getJsonValidationErrorsFromAfter(after),
  onUpdate: async (changes: ReadonlyArray<Change>): Promise<ReadonlyArray<ChangeError>> => {
    const getChangeError = async (change: Change): Promise<ReadonlyArray<ChangeError>> => {
      const changeElement = getChangeElement(change)
      if (isInstanceElement(changeElement) && isModificationDiff(change)) {
        return getJsonValidationErrorsFromAfter(change.data.after as InstanceElement)
      }
      return []
    }
    return _.flatten(await Promise.all(changes.map(change => getChangeError(change))))
  },
}

export default changeValidator
