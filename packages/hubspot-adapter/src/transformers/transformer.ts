import _ from 'lodash'
import {
  ElemID, ObjectType,
  PrimitiveType, PrimitiveTypes,
  Field as TypeField, BuiltinTypes, InstanceElement, Values,
  Type, CORE_ANNOTATIONS, transform,
} from 'adapter-api'
import {
  FIELD_TYPES,
  FORM_FIELDS,
  HUBSPOT,
  OBJECTS_NAMES,
  PROPERTY_FIELDS,
  PROPERTY_GROUP_FIELDS,
  OPTIONS_FIELDS,
  CONTACTLISTIDS_FIELDS, WORKFLOWS_FIELDS, MARKETINGEMAIL_FIELDS,
} from '../constants'
import {
  HubspotMetadata,
} from '../client/types'


const formElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.FORM)
const workflowsElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.WORKFLOWS)
const marketingEmailElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.MARKETINGEMAIL)

const propertyGroupElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.PROPERTYGROUP)
const propertyElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.PROPERTY)
const optionsElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.OPTIONS)
const contactListIdsElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.CONTACTLISTIDS)

export class Types {
  private static optionsType: ObjectType =
    new ObjectType({
      elemID: optionsElemID,
      fields: {
        [OPTIONS_FIELDS.LABEL]: new TypeField(
          optionsElemID, OPTIONS_FIELDS.LABEL, BuiltinTypes.STRING, {
            name: OPTIONS_FIELDS.LABEL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [OPTIONS_FIELDS.VALUE]: new TypeField(
          optionsElemID, OPTIONS_FIELDS.VALUE, BuiltinTypes.STRING, {
            name: OPTIONS_FIELDS.VALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [OPTIONS_FIELDS.DISPLAYORDER]: new TypeField(
          optionsElemID, OPTIONS_FIELDS.DISPLAYORDER, BuiltinTypes.NUMBER, {
            name: OPTIONS_FIELDS.DISPLAYORDER,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [OPTIONS_FIELDS.HIDDEN]: new TypeField(
          optionsElemID, OPTIONS_FIELDS.HIDDEN, BuiltinTypes.BOOLEAN, {
            name: OPTIONS_FIELDS.HIDDEN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [OPTIONS_FIELDS.DESCRIPTION]: new TypeField(
          optionsElemID, OPTIONS_FIELDS.DESCRIPTION, BuiltinTypes.STRING, {
            name: OPTIONS_FIELDS.DESCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', optionsElemID.name],
    })

  private static propertyType: ObjectType =
    new ObjectType({
      elemID: propertyElemID,
      fields: {
        [PROPERTY_FIELDS.NAME]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.NAME, BuiltinTypes.STRING, {
            name: PROPERTY_FIELDS.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.LABEL]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.LABEL, BuiltinTypes.STRING, {
            name: PROPERTY_FIELDS.LABEL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.DESCRIPTION]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.DESCRIPTION, BuiltinTypes.STRING, {
            name: PROPERTY_FIELDS.DESCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.GROUPNAME]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.GROUPNAME, BuiltinTypes.STRING, {
            name: PROPERTY_FIELDS.GROUPNAME,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.TYPE]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.TYPE, BuiltinTypes.STRING, {
            name: PROPERTY_FIELDS.TYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.FIELDTYPE]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.FIELDTYPE, BuiltinTypes.STRING, {
            name: PROPERTY_FIELDS.FIELDTYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.ISSMARTFIELD]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.ISSMARTFIELD, BuiltinTypes.BOOLEAN, {
            name: PROPERTY_FIELDS.ISSMARTFIELD,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.REQUIRED]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.REQUIRED, BuiltinTypes.BOOLEAN, {
            name: PROPERTY_FIELDS.REQUIRED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.HIDDEN]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.HIDDEN, BuiltinTypes.BOOLEAN, {
            name: PROPERTY_FIELDS.HIDDEN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.DEFAULTVALUE]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.DEFAULTVALUE, BuiltinTypes.STRING, {
            name: PROPERTY_FIELDS.DEFAULTVALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.SELECTEDOPTIONS]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.SELECTEDOPTIONS, BuiltinTypes.STRING, {
            name: PROPERTY_FIELDS.SELECTEDOPTIONS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        [PROPERTY_FIELDS.OPTIONS]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.OPTIONS, Types.optionsType, {
            name: PROPERTY_FIELDS.OPTIONS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', propertyElemID.name],
    })

  private static propertyGroupType: ObjectType =
    new ObjectType({
      elemID: propertyGroupElemID,
      fields: {
        [PROPERTY_GROUP_FIELDS.DEFAULT]: new TypeField(
          propertyGroupElemID, PROPERTY_GROUP_FIELDS.DEFAULT, BuiltinTypes.BOOLEAN, {
            name: PROPERTY_GROUP_FIELDS.DEFAULT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_GROUP_FIELDS.FIELDS]: new TypeField(
          propertyGroupElemID, PROPERTY_GROUP_FIELDS.FIELDS, Types.propertyType, {
            name: PROPERTY_GROUP_FIELDS.FIELDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        [PROPERTY_GROUP_FIELDS.ISSMARTGROUP]: new TypeField(
          propertyGroupElemID, PROPERTY_GROUP_FIELDS.ISSMARTGROUP, BuiltinTypes.BOOLEAN, {
            name: PROPERTY_GROUP_FIELDS.ISSMARTGROUP,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', propertyGroupElemID.name],
    })

  private static contactListIdsType: ObjectType =
    new ObjectType({
      elemID: contactListIdsElemID,
      fields: {
        [CONTACTLISTIDS_FIELDS.ENROLLED]: new TypeField(
          contactListIdsElemID, CONTACTLISTIDS_FIELDS.ENROLLED, BuiltinTypes.NUMBER, {
            name: CONTACTLISTIDS_FIELDS.ENROLLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACTLISTIDS_FIELDS.ACTIVE]: new TypeField(
          contactListIdsElemID, CONTACTLISTIDS_FIELDS.ACTIVE, BuiltinTypes.NUMBER, {
            name: CONTACTLISTIDS_FIELDS.ACTIVE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACTLISTIDS_FIELDS.SUCCEEDED]: new TypeField(
          contactListIdsElemID, CONTACTLISTIDS_FIELDS.SUCCEEDED, BuiltinTypes.NUMBER, {
            name: CONTACTLISTIDS_FIELDS.SUCCEEDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [CONTACTLISTIDS_FIELDS.COMPLETED]: new TypeField(
          contactListIdsElemID, CONTACTLISTIDS_FIELDS.COMPLETED, BuiltinTypes.NUMBER, {
            name: CONTACTLISTIDS_FIELDS.COMPLETED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', contactListIdsElemID.name],
    })


  /**
   * This method create array of all supported Hubspot objects.
   * This is static creation cause hubspot API support only instances.
   */
  public static hubspotObjects: Record<string, ObjectType> = {
    [OBJECTS_NAMES.FORM]: new ObjectType({
      elemID: formElemID,
      fields: {
        [FORM_FIELDS.GUID]: new TypeField(
          formElemID, FORM_FIELDS.GUID, BuiltinTypes.STRING, {
            name: FORM_FIELDS.GUID,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [FORM_FIELDS.NAME]: new TypeField(
          formElemID, FORM_FIELDS.NAME, BuiltinTypes.STRING, {
            name: FORM_FIELDS.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [FORM_FIELDS.CSSCLASS]: new TypeField(
          formElemID, FORM_FIELDS.CSSCLASS, BuiltinTypes.STRING, {
            name: FORM_FIELDS.CSSCLASS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.REDIRECT]: new TypeField(
          formElemID, FORM_FIELDS.REDIRECT, BuiltinTypes.STRING, {
            name: FORM_FIELDS.REDIRECT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.SUBMITTEXT]: new TypeField(
          formElemID, FORM_FIELDS.SUBMITTEXT, BuiltinTypes.STRING, {
            name: FORM_FIELDS.SUBMITTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.NOTIFYRECIPIENTS]: new TypeField(
          formElemID, FORM_FIELDS.NOTIFYRECIPIENTS, BuiltinTypes.STRING, {
            name: FORM_FIELDS.NOTIFYRECIPIENTS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.IGNORECURRENTVALUES]: new TypeField(
          formElemID, FORM_FIELDS.IGNORECURRENTVALUES, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.IGNORECURRENTVALUES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.DELETABLE]: new TypeField(
          formElemID, FORM_FIELDS.DELETABLE, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.DELETABLE,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.INLINEMESSAGE]: new TypeField(
          formElemID, FORM_FIELDS.INLINEMESSAGE, BuiltinTypes.STRING, {
            name: FORM_FIELDS.INLINEMESSAGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.FORMFIELDGROUPS]: new TypeField(
          formElemID, FORM_FIELDS.FORMFIELDGROUPS, Types.propertyGroupType, {
            name: FORM_FIELDS.FORMFIELDGROUPS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        [FORM_FIELDS.CAPTCHAENABLED]: new TypeField(
          formElemID, FORM_FIELDS.CAPTCHAENABLED, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.CAPTCHAENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.CREATEDAT]: new TypeField( // TODO: format milli -> readable date
          formElemID, FORM_FIELDS.CREATEDAT, BuiltinTypes.NUMBER, {
            name: FORM_FIELDS.CREATEDAT,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.CLONEABLE]: new TypeField(
          formElemID, FORM_FIELDS.CLONEABLE, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.CLONEABLE,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.STYLE]: new TypeField(
          formElemID, FORM_FIELDS.STYLE, BuiltinTypes.STRING, {
            name: FORM_FIELDS.STYLE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [FORM_FIELDS.EDITABLE]: new TypeField(
          formElemID, FORM_FIELDS.EDITABLE, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.EDITABLE,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, 'objects', formElemID.name],
    }),
    [OBJECTS_NAMES.WORKFLOWS]: new ObjectType({
      elemID: workflowsElemID,
      fields: {
        [WORKFLOWS_FIELDS.ID]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.ID, BuiltinTypes.NUMBER, {
            name: WORKFLOWS_FIELDS.ID,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [WORKFLOWS_FIELDS.NAME]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.NAME, BuiltinTypes.STRING, {
            name: WORKFLOWS_FIELDS.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [WORKFLOWS_FIELDS.TYPE]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.TYPE, BuiltinTypes.STRING, {
            name: WORKFLOWS_FIELDS.TYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.ENABLED]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.ENABLED, BuiltinTypes.BOOLEAN, {
            name: WORKFLOWS_FIELDS.ENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.INSERTEDAT]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.INSERTEDAT, BuiltinTypes.NUMBER, {
            name: WORKFLOWS_FIELDS.INSERTEDAT,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.UPDATEDAT]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.UPDATEDAT, BuiltinTypes.NUMBER, {
            name: WORKFLOWS_FIELDS.UPDATEDAT,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [WORKFLOWS_FIELDS.CONTACTLISTIDS]: new TypeField(
          workflowsElemID, WORKFLOWS_FIELDS.CONTACTLISTIDS, Types.contactListIdsType, {
            name: WORKFLOWS_FIELDS.CONTACTLISTIDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, 'objects', workflowsElemID.name],
    }),
    [OBJECTS_NAMES.MARKETINGEMAIL]: new ObjectType({
      elemID: marketingEmailElemID,
      fields: {
        [MARKETINGEMAIL_FIELDS.ID]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.ID, BuiltinTypes.NUMBER, {
            name: MARKETINGEMAIL_FIELDS.ID,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [MARKETINGEMAIL_FIELDS.NAME]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.NAME, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [MARKETINGEMAIL_FIELDS.AB]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.AB, BuiltinTypes.BOOLEAN, {
            name: MARKETINGEMAIL_FIELDS.AB,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.ABHOURSTOWAIT]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.ABHOURSTOWAIT, BuiltinTypes.NUMBER, {
            name: MARKETINGEMAIL_FIELDS.ABHOURSTOWAIT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.ABVARIATION]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.ABVARIATION, BuiltinTypes.BOOLEAN, {
            name: MARKETINGEMAIL_FIELDS.ABVARIATION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.ABSAMPLESIZEDEFAULT]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.ABSAMPLESIZEDEFAULT, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.ABSAMPLESIZEDEFAULT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.ABSAMPLINGDEFAULT]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.ABSAMPLINGDEFAULT, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.ABSAMPLINGDEFAULT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.ABSTATUS]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.ABSTATUS, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.ABSTATUS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.ABSUCCESSMETRIC]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.ABSUCCESSMETRIC, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.ABSUCCESSMETRIC,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.ABTESTID]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.ABTESTID, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.ABTESTID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.ABTESTPERCENTAGE]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.ABTESTPERCENTAGE, BuiltinTypes.NUMBER, {
            name: MARKETINGEMAIL_FIELDS.ABTESTPERCENTAGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.ABSOLUTEURL]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.ABSOLUTEURL, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.ABSOLUTEURL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.ALLEMAILCAMPAIGNIDS]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.ALLEMAILCAMPAIGNIDS, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.ALLEMAILCAMPAIGNIDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        [MARKETINGEMAIL_FIELDS.ANALYTICSPAGEID]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.ANALYTICSPAGEID, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.ANALYTICSPAGEID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.ARCHIVED]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.ARCHIVED, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.ARCHIVED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.AUTHOR]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.AUTHOR, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.AUTHOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.AUTHOREMAIL]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.AUTHOREMAIL, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.AUTHOREMAIL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.AUTHORNAME]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.AUTHORNAME, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.AUTHORNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.BLOGEMAILTYPED]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.BLOGEMAILTYPED, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.BLOGEMAILTYPED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.CAMPAIGN]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.CAMPAIGN, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.CAMPAIGN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.CAMPAIGNNAME]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.CAMPAIGNNAME, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.CAMPAIGNNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.CANSPAMID]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.CANSPAMID, BuiltinTypes.NUMBER, {
            name: MARKETINGEMAIL_FIELDS.CANSPAMID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.CLONEDFORM]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.CLONEDFORM, BuiltinTypes.NUMBER, {
            name: MARKETINGEMAIL_FIELDS.CLONEDFORM,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.CREATEPAGE]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.CREATEPAGE, BuiltinTypes.BOOLEAN, {
            name: MARKETINGEMAIL_FIELDS.CREATEPAGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.CREATED]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.CREATED, BuiltinTypes.NUMBER, {
            name: MARKETINGEMAIL_FIELDS.CREATED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.CURRENTLYPUBLISHED]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.CURRENTLYPUBLISHED, BuiltinTypes.BOOLEAN, {
            name: MARKETINGEMAIL_FIELDS.CURRENTLYPUBLISHED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.DOMAIN]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.DOMAIN, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.DOMAIN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [MARKETINGEMAIL_FIELDS.EMAILBODY]: new TypeField(
          marketingEmailElemID, MARKETINGEMAIL_FIELDS.EMAILBODY, BuiltinTypes.STRING, {
            name: MARKETINGEMAIL_FIELDS.EMAILBODY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, 'objects', marketingEmailElemID.name],
    }),
  }


  public static hubspotSubTypes: ObjectType[] = [
    Types.propertyGroupType,
    Types.propertyType,
    Types.optionsType,
    Types.contactListIdsType,
  ]

  private static fieldTypes: Record<string, Type> = {
    [FIELD_TYPES.TEXTAREA]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.TEXTAREA),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.TEXT]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.TEXT),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.DATE]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.DATE),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.FILE]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.FILE),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.NUMBER]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.NUMBER),
      primitive: PrimitiveTypes.NUMBER,
    }),
    [FIELD_TYPES.SELECT]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.SELECT),
      primitive: PrimitiveTypes.NUMBER,
    }),
    [FIELD_TYPES.RADIO]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.RADIO),
      primitive: PrimitiveTypes.NUMBER,
    }),
    [FIELD_TYPES.CHECKBOX]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.CHECKBOX),
      primitive: PrimitiveTypes.NUMBER,
    }),
    [FIELD_TYPES.BOOLEANCHECKBOX]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.BOOLEANCHECKBOX),
      primitive: PrimitiveTypes.NUMBER,
    }),
  }

  /**
   * This method create all the (basic) field types
   */
  static getAllFieldTypes(): Type[] {
    return _.concat(
      Object.values(Types.fieldTypes),
    ).map(type => {
      const fieldType = type.clone()
      fieldType.path = [HUBSPOT, 'types', 'field_types']
      return fieldType
    })
  }
}

export const createInstanceName = (
  name: string
): string => name.trim().split(' ').join('_')

/**
 * This method generate (instance) values by iterating hubspot object fields.
 * Also ensure that only expected fields will shown
 * @param info
 * @param infoType
 */
export const fromHubspotObject = (
  info: HubspotMetadata,
  infoType: ObjectType
): Values =>
  transform(info as Values, infoType) || {}

/**
 * Creating all the instance for specific type
 * @param hubspotMetadata the instance metadata from hubspot
 * @param type the objectType
 */
export const createHubspotInstanceElement = (
  hubspotMetadata: HubspotMetadata,
  type: ObjectType
): InstanceElement => {
  const typeName = type.elemID.name
  const values = fromHubspotObject(hubspotMetadata, type)
  const instanceName = createInstanceName(hubspotMetadata.name)
  return new InstanceElement(
    new ElemID(HUBSPOT, instanceName).name,
    type,
    values,
    [HUBSPOT, 'records', typeName, instanceName],
  )
}
