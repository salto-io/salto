import { ObjectType, ElemID, Field, PrimitiveType, PrimitiveTypes, BuiltinTypes } from "@salto-io/adapter-api"

const sfText = new PrimitiveType({
  elemID: new ElemID('salesforce', 'Text'),
  primitive: PrimitiveTypes.STRING,
  annotationTypes: {
    label: BuiltinTypes.STRING,
    _required: BuiltinTypes.BOOLEAN
  }
})

export const customObject= (
  data : {objName: string, alphaLabel: string, betaLabel: string}
): ObjectType => {
  const elemID =  new ElemID('salesforce', data.objName)
  return new ObjectType({
    elemID,
    fields: {
      alpha : new Field(elemID, 'alpha', sfText, {
        label: data.alphaLabel
      }),
      beta : new Field(elemID, 'beta', sfText, {
        label: data.betaLabel
      })
    }
  })
}