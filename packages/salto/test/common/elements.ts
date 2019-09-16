import {
  Type, BuiltinTypes, ElemID, ObjectType,
  Field, InstanceElement, Element,
} from 'adapter-api'
import { Blueprint } from '../../src/core/blueprint'


const addrElemID = new ElemID('salto', 'address')
export const saltoAddr = new ObjectType({
  elemID: addrElemID,
  fields: {
    country: new Field(addrElemID, 'country', BuiltinTypes.STRING),
    city: new Field(addrElemID, 'city', BuiltinTypes.STRING),
  },
  annotationTypes: { label: BuiltinTypes.STRING },
})

const officeElemID = new ElemID('salto', 'office')
export const saltoOffice = new ObjectType({
  elemID: officeElemID,
  fields: {
    name: new Field(officeElemID, 'name', BuiltinTypes.STRING),
    location: new Field(
      officeElemID,
      'location',
      saltoAddr,
      {
        label: 'Office Location',
        description: 'A location of an office',
      },
    ),
  },
  annotationTypes: { label: BuiltinTypes.STRING },
})

const employeeElemID = new ElemID('salto', 'employee')
export const saltoEmployee = new ObjectType({
  elemID: employeeElemID,
  fields: {
    name: new Field(
      employeeElemID,
      'name',
      BuiltinTypes.STRING,
      { _required: true },
    ),
    nicknames: new Field(
      employeeElemID,
      'nicknames',
      BuiltinTypes.STRING,
      {},
      true
    ),
    /* eslint-disable-next-line @typescript-eslint/camelcase */
    employee_resident: new Field(
      employeeElemID,
      'employee_resident',
      saltoAddr,
      { label: 'Employee Resident' }
    ),
    company: new Field(
      employeeElemID,
      'company',
      BuiltinTypes.STRING,
      { _default: 'salto' },
    ),
    office: new Field(
      employeeElemID,
      'office',
      saltoOffice,
      {
        label: 'Based In',
        name: {
          [Type.DEFAULT]: 'HQ',
        },
        location: {
          country: {
            [Type.DEFAULT]: 'IL',
          },
          city: {
            [Type.DEFAULT]: 'Raanana',
          },
        },
      },
    ),
  },
})

export const saltoEmployeeInstance = new InstanceElement(new ElemID('salto', 'employee_instance'),
  saltoEmployee, { name: 'FirstEmployee' })

export const getAllElements = (_blueprints: Blueprint[] = []): Element[] =>
  [BuiltinTypes.STRING, saltoAddr, saltoOffice, saltoEmployee, saltoEmployeeInstance]
