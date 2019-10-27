import _ from 'lodash'
import jszip from 'jszip'
import {
  ObjectType, ElemID, InstanceElement, Field, BuiltinTypes, Type, Field as TypeField, Values,
} from 'adapter-api'
import { Field as SalesforceField, ValueTypeField } from 'jsforce'
import {
  toMetadataPackageZip, bpCase, getSObjectFieldElement, Types, toCustomField, toCustomObject,
  getValueTypeFieldElement,
} from '../src/transformer'
import {
  METADATA_TYPE, METADATA_OBJECT_NAME_FIELD, FIELD_ANNOTATIONS, FIELD_TYPE_NAMES, API_NAME,
  LABEL, FIELD_TYPE_API_NAMES,
} from '../src/constants'
import { CustomField } from '../src/client/types'

describe('transformer', () => {
  const dummyTypeId = new ElemID('adapter', 'dummy')
  const dummyType = new ObjectType({
    elemID: dummyTypeId,
    annotations: {
      [METADATA_TYPE]: 'Dummy',
    },
    fields: {
      str: new Field(dummyTypeId, 'str', BuiltinTypes.STRING),
      lst: new Field(dummyTypeId, 'lst', BuiltinTypes.NUMBER, {}, true),
      bool: new Field(dummyTypeId, 'bool', BuiltinTypes.BOOLEAN),
    },
  })
  const dummyInstance = new InstanceElement(
    new ElemID('adapter', 'instance'),
    dummyType,
    {
      [bpCase(METADATA_OBJECT_NAME_FIELD)]: 'Instance',
      str: 'val',
      lst: [1, 2],
      bool: true,
    },
  )

  describe('toMetadataPackageZip', () => {
    const zip = toMetadataPackageZip(dummyInstance)
      .then(buf => jszip.loadAsync(buf))

    it('should contain package xml', async () => {
      const packageXml = (await zip).files['default/package.xml']
      expect(packageXml).toBeDefined()
      expect(await packageXml.async('text')).toMatch(
        `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
           <types><members>Instance</members><name>Dummy</name></types>
           <version>46.0</version>
         </Package>`.replace(/>\s+</gs, '><')
      )
    })

    it('should contain instance xml', async () => {
      const instanceXml = (await zip).files['default/dummy/Instance.dummy']
      expect(instanceXml).toBeDefined()
      expect(await instanceXml.async('text')).toMatch(
        `<Dummy xmlns="http://soap.sforce.com/2006/04/metadata">
           <str>val</str>
           <lst>1</lst>
           <lst>2</lst>
           <bool>true</bool>
         </Dummy>`.replace(/>\s+</gs, '><')
      )
    })
  })

  describe('getValueTypeFieldElement', () => {
    const salesforceValueTypeFieldBase: ValueTypeField = {
      fields: [],
      foreignKeyDomain: '',
      isForeignKey: false,
      isNameField: false,
      minOccurs: 0,
      name: 'Field',
      picklistValues: [],
      soapType: 'String',
      valueRequired: false,
    }
    const salesforceEnumField: ValueTypeField = _.merge({}, salesforceValueTypeFieldBase, {
      picklistValues: [
        { active: true, defaultValue: false, value: 'b' },
        { active: true, defaultValue: false, value: 'a' },
        { active: true, defaultValue: false, value: 'a' },
      ],
    })
    describe('enum field', () => {
      let enumField: TypeField
      beforeEach(() => {
        enumField = getValueTypeFieldElement(dummyTypeId, salesforceEnumField, new Map())
      })
      describe('restriction values', () => {
        it('should not have duplicate values', () => {
          expect(enumField.annotations[Type.VALUES]).toHaveLength(2)
        })
        it('should be sorted alphabetically', () => {
          expect(enumField.annotations[Type.VALUES]).toEqual(['a', 'b'])
        })
      })
    })
  })

  describe('getSObjectFieldElement', () => {
    const origSalesforceReferenceField: SalesforceField = {
      aggregatable: false,
      cascadeDelete: false,
      dependentPicklist: false,
      externalId: false,
      htmlFormatted: false,
      autoNumber: false,
      byteLength: 18,
      calculated: false,
      caseSensitive: false,
      createable: true,
      custom: false,
      defaultedOnCreate: true,
      deprecatedAndHidden: false,
      digits: 0,
      filterable: true,
      groupable: true,
      idLookup: false,
      label: 'Owner ID',
      length: 18,
      name: 'OwnerId',
      nameField: false,
      namePointing: true,
      nillable: false,
      permissionable: false,
      polymorphicForeignKey: true,
      precision: 0,
      queryByDistance: false,
      referenceTo: [
        'Group',
        // eslint-disable-next-line comma-dangle
        'User'
      ],
      relationshipName: 'Owner',
      restrictedPicklist: false,
      scale: 0,
      searchPrefilterable: false,
      soapType: 'tns:ID',
      sortable: true,
      type: 'reference',
      unique: false,
      // eslint-disable-next-line comma-dangle
      updateable: true
    }

    let salesforceReferenceField: SalesforceField
    beforeEach(() => {
      salesforceReferenceField = _.cloneDeep(origSalesforceReferenceField)
    })

    const dummyElemID = new ElemID('adapter', 'dummy')

    const assertReferenceFieldTransformation = (fieldElement: Field, expectedRelatedTo: string[],
      expectedType: Type, expectedName: string,
      expectedAllowLookupRecordDeletion: boolean | undefined):
        void => {
      expect(fieldElement.type).toEqual(expectedType)
      expect(fieldElement.name).toEqual(expectedName)
      expect(fieldElement.annotations[FIELD_ANNOTATIONS.RELATED_TO])
        .toHaveLength(expectedRelatedTo.length)
      expectedRelatedTo.forEach(expectedRelatedToValue =>
        expect(fieldElement.annotations[FIELD_ANNOTATIONS.RELATED_TO])
          .toContain(expectedRelatedToValue))
      expect(fieldElement.annotations[FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION])
        .toEqual(expectedAllowLookupRecordDeletion)
    }

    it('should discover lookup relationships with restricted deletion', async () => {
      _.set(salesforceReferenceField, 'restrictedDelete', true)
      const fieldElement = getSObjectFieldElement(dummyElemID, salesforceReferenceField)
      assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.salesforceDataTypes.lookup, 'owner', false)
    })

    it('should discover lookup relationships with allowed related record deletion when restrictedDelete set to false', async () => {
      _.set(salesforceReferenceField, 'restrictedDelete', false)
      const fieldElement = getSObjectFieldElement(dummyElemID, salesforceReferenceField)
      assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.salesforceDataTypes.lookup, 'owner', true)
    })

    it('should discover lookup relationships with allowed related record deletion when restrictedDelete is undefined', async () => {
      _.set(salesforceReferenceField, 'restrictedDelete', undefined)
      const fieldElement = getSObjectFieldElement(dummyElemID, salesforceReferenceField)
      assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.salesforceDataTypes.lookup, 'owner', true)
    })

    it('should use field name as name in case relationshipName is not specified', async () => {
      salesforceReferenceField.relationshipName = undefined
      const fieldElement = getSObjectFieldElement(dummyElemID, salesforceReferenceField)
      assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.salesforceDataTypes.lookup, 'owner_id', true)
    })

    it('should slice field name in case relationshipName is a custom relationship', async () => {
      salesforceReferenceField.relationshipName = 'CustomRelationshipName__r'
      const fieldElement = getSObjectFieldElement(dummyElemID, salesforceReferenceField)
      assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.salesforceDataTypes.lookup, 'custom_relationship_name', true)
    })

    it('should discover masterdetail relationships', async () => {
      salesforceReferenceField.cascadeDelete = true
      const fieldElement = getSObjectFieldElement(dummyElemID, salesforceReferenceField)
      assertReferenceFieldTransformation(fieldElement, ['Group', 'User'], Types.salesforceDataTypes.masterdetail, 'owner', undefined)
    })
  })

  describe('toCustomObject', () => {
    const elemID = new ElemID('salesforce', 'test')
    const relatedTo = ['User', 'Property__c']
    const annotations: Values = {
      [API_NAME]: 'field_name',
      [LABEL]: 'field_label',
      [Type.REQUIRED]: false,
      [FIELD_ANNOTATIONS.RELATED_TO]: relatedTo,
    }
    const fieldName = 'field_name'
    const origObjectType = new ObjectType({ elemID,
      fields: { [fieldName]: new TypeField(elemID, fieldName, Types.get(FIELD_TYPE_NAMES.LOOKUP),
        annotations) } })
    let objectType: ObjectType
    beforeEach(() => {
      objectType = _.cloneDeep(origObjectType)
    })

    const assertCustomFieldTransformation = (customField: CustomField, expectedType: string,
      expectedRelationshipName: string, expectedDeleteConstraint: string | undefined,
      expectedReferenceTo: string[]):
        void => {
      expect(customField.type).toEqual(expectedType)
      expect(customField.relationshipName).toEqual(expectedRelationshipName)
      expect(customField.deleteConstraint).toEqual(expectedDeleteConstraint)
      expect(customField.referenceTo).toEqual(expectedReferenceTo)
    }

    it('should transform lookup field with deletion constraint', async () => {
      // eslint-disable-next-line max-len
      objectType.fields[fieldName].annotations[FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION] = false
      const customLookupField = toCustomField(objectType, objectType.fields[fieldName])
      assertCustomFieldTransformation(customLookupField,
        FIELD_TYPE_API_NAMES[FIELD_TYPE_NAMES.LOOKUP], 'FieldName', 'Restrict', relatedTo)
    })

    it('should transform lookup field with no deletion constraint', async () => {
      // eslint-disable-next-line max-len
      objectType.fields[fieldName].annotations[FIELD_ANNOTATIONS.ALLOW_LOOKUP_RECORD_DELETION] = true
      const customLookupField = toCustomField(objectType, objectType.fields[fieldName])
      assertCustomFieldTransformation(customLookupField,
        FIELD_TYPE_API_NAMES[FIELD_TYPE_NAMES.LOOKUP], 'FieldName', 'SetNull', relatedTo)
    })

    it('should transform masterdetail field', async () => {
      objectType.fields[fieldName].type = Types.get(FIELD_TYPE_NAMES.MASTER_DETAIL)
      const customLookupField = toCustomField(objectType, objectType.fields[fieldName])
      assertCustomFieldTransformation(customLookupField,
        FIELD_TYPE_API_NAMES[FIELD_TYPE_NAMES.MASTER_DETAIL], 'FieldName', undefined, relatedTo)
    })

    it('should have ControlledByParent sharing model when having masterdetail field', async () => {
      objectType.fields[fieldName].type = Types.get(FIELD_TYPE_NAMES.MASTER_DETAIL)
      const customObjectWithMasterDetailField = toCustomObject(objectType, true)
      expect(customObjectWithMasterDetailField.sharingModel).toEqual('ControlledByParent')
    })

    it('should have ReadWrite sharing model when not having masterdetail field', async () => {
      const customObjectWithMasterDetailField = toCustomObject(objectType, true)
      expect(customObjectWithMasterDetailField.sharingModel).toEqual('ReadWrite')
    })

    it('should have ReadWrite sharing model when not including fields', async () => {
      const customObjectWithMasterDetailField = toCustomObject(objectType, false)
      expect(customObjectWithMasterDetailField.sharingModel).toEqual('ReadWrite')
    })
  })
})
