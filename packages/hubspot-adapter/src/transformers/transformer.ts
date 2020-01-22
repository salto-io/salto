import _ from 'lodash'
import {
  ElemID, ObjectType,
  PrimitiveType, PrimitiveTypes, PrimitiveValue, PrimitiveField,
  Field as TypeField, BuiltinTypes, InstanceElement, Values,
  TypeElement, CORE_ANNOTATIONS, transform, TypeMap,
} from 'adapter-api'
import {
  FIELD_TYPES, FORM_FIELDS, HUBSPOT, OBJECTS_NAMES, PROPERTY_FIELDS, RSSTOEMAILTIMING_FIELDS,
  PROPERTY_GROUP_FIELDS, OPTIONS_FIELDS, CONTACTLISTIDS_FIELDS,
  WORKFLOWS_FIELDS, MARKETING_EMAIL_FIELDS,
} from '../constants'
import {
  HubspotMetadata,
} from '../client/types'

const formElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.FORM)
const workflowsElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.WORKFLOWS)
const propertyGroupElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.PROPERTYGROUP)
const propertyElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.PROPERTY)
const optionsElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.OPTIONS)
const contactListIdsElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.CONTACTLISTIDS)
const marketingEmailElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.MARKETINGEMAIL)
const rssToEmailTimingElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.RSSTOEMAILTIMING)

export class Types {
  private static fieldTypes: TypeMap = {
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

  private static rssToEmailTimingType: ObjectType =
    new ObjectType({
      elemID: rssToEmailTimingElemID,
      fields: {
        [RSSTOEMAILTIMING_FIELDS.REPEATS]: new TypeField(
          rssToEmailTimingElemID, RSSTOEMAILTIMING_FIELDS.REPEATS, BuiltinTypes.STRING, {
            name: RSSTOEMAILTIMING_FIELDS.REPEATS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['instant', 'daily', 'weekly', 'monthly'],
          },
        ),
        [RSSTOEMAILTIMING_FIELDS.REPEATS_ON_MONTHLY]: new TypeField(
          rssToEmailTimingElemID, RSSTOEMAILTIMING_FIELDS.REPEATS_ON_MONTHLY, BuiltinTypes.NUMBER, {
            name: RSSTOEMAILTIMING_FIELDS.REPEATS_ON_MONTHLY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [RSSTOEMAILTIMING_FIELDS.REPEATS_ON_WEEKLY]: new TypeField(
          rssToEmailTimingElemID, RSSTOEMAILTIMING_FIELDS.REPEATS_ON_WEEKLY, BuiltinTypes.NUMBER, {
            name: RSSTOEMAILTIMING_FIELDS.REPEATS_ON_WEEKLY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [RSSTOEMAILTIMING_FIELDS.TIME]: new TypeField(
          rssToEmailTimingElemID, RSSTOEMAILTIMING_FIELDS.TIME, BuiltinTypes.STRING, {
            name: RSSTOEMAILTIMING_FIELDS.TIME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: [HUBSPOT, 'types', 'subtypes', rssToEmailTimingElemID.name],
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
        [MARKETING_EMAIL_FIELDS.AB]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AB, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.AB,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABHOURSWAIT]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABHOURSWAIT, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.ABHOURSWAIT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABVARIATION]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABVARIATION, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ABVARIATION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABSAMPLESIZEDEFAULT]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABSAMPLESIZEDEFAULT, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ABSAMPLESIZEDEFAULT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['master', 'variant'],
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABSAMPLINGDEFAULT]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABSAMPLINGDEFAULT, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ABSAMPLINGDEFAULT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['master', 'variant'],
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABSTATUS]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABSTATUS, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ABSTATUS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['master', 'variant'],
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABSUCCESSMETRIC]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABSUCCESSMETRIC, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ABSUCCESSMETRIC,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['CLICKS_BY_OPENS', 'CLICKS_BY_DELIVERED', 'OPENS_BY_DELIVERED'],
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABTESTID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABTESTID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.ABTESTID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABTESTPERCENTAGE]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABTESTPERCENTAGE, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.ABTESTPERCENTAGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ABSOLUTEURL]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ABSOLUTEURL, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ABSOLUTEURL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ALLEMAILCAMPAIGNIDS]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ALLEMAILCAMPAIGNIDS, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.ALLEMAILCAMPAIGNIDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        [MARKETING_EMAIL_FIELDS.ANALYTICSPAGEID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ANALYTICSPAGEID, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ANALYTICSPAGEID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ANALYTICSPAGETYPE]: new TypeField( // TODO: Decide if to keep
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ANALYTICSPAGETYPE, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.ANALYTICSPAGETYPE,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: 'email',
          }
        ),
        [MARKETING_EMAIL_FIELDS.ARCHIVED]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ARCHIVED, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ARCHIVED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.AUTHOR]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AUTHOR, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.AUTHOR,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.AUTHORAT]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AUTHORAT, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.AUTHORAT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.AUTHOREMAIL]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AUTHOREMAIL, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.AUTHOREMAIL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.AUTHORNAME]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AUTHORNAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.AUTHORNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.AUTHORUSERID]: new TypeField( // TODO: Replace with user's email
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.AUTHORUSERID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.AUTHORUSERID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.BLOGEMAILTYPE]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.BLOGEMAILTYPE, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.BLOGEMAILTYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['instant', 'daily', 'weekly', 'monthly'],
          }
        ),
        [MARKETING_EMAIL_FIELDS.BLOGRSSSETTINGS]: new TypeField(
          // TODO: Format this the right way
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.BLOGRSSSETTINGS, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.BLOGRSSSETTINGS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CAMPAIGN]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CAMPAIGN, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.CAMPAIGN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CAMPAIGNNAME]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CAMPAIGNNAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.CAMPAIGNNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CANSPAMSETTINGSID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CANSPAMSETTINGSID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.CANSPAMSETTINGSID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CATEGORYID]: new TypeField( // TODO: Decide if to keep
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CATEGORYID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.CATEGORYID,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: 2,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CLONEDFROM]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CLONEDFROM, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.CLONEDFROM,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CONTENTTYPECATEGORY]: new TypeField( // TODO: Decide if to keep
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CONTENTTYPECATEGORY, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.CONTENTTYPECATEGORY,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.DEFAULT]: 2,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CREATEPAGE]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CREATEPAGE, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.CREATEPAGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CREATED]: new TypeField(
          // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CREATED, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.CREATED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.CURRENTLYPUBLISHED]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.CURRENTLYPUBLISHED, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.CURRENTLYPUBLISHED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.DOMAIN]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.DOMAIN, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.DOMAIN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.EMAILBODY]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.EMAILBODY, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.EMAILBODY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          }
        ),
        [MARKETING_EMAIL_FIELDS.EMAILNOTE]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.EMAILNOTE, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.EMAILNOTE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.EMAILTYPE]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.EMAILTYPE, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.EMAILTYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['BATCH_EMAIL', 'AB_EMAIL', 'AUTOMATED_EMAIL', 'BLOG_EMAIL', 'BLOG_EMAIL_CHILD', 'FOLLOWUP_EMAIL',
              'LOCALTIME_EMAIL', 'OPTIN_EMAIL', 'OPTIN_FOLLOWUP_EMAIL', 'RESUBSCRIBE_EMAIL', 'RSS_EMAIL', 'RSS_EMAIL_CHILD', 'SINGLE_SEND_API',
              'SMTP_TOKEN', 'LEADFLOW_EMAIL', 'FEEDBACK_CES_EMAIL', 'FEEDBACK_NPS_EMAIL', 'FEEDBACK_CUSTOM_EMAIL', 'TICKET_EMAIL',
            ],
          }
        ),
        [MARKETING_EMAIL_FIELDS.FEEDBACKEMAILCATEGORY]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FEEDBACKEMAILCATEGORY, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.FEEDBACKEMAILCATEGORY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['NPS', 'CES', 'CUSTOM'],
          }
        ),
        [MARKETING_EMAIL_FIELDS.FEEDBACKSURVEYID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FEEDBACKSURVEYID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.FEEDBACKSURVEYID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.FLEXAREAS]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FLEXAREAS, BuiltinTypes.JSON, {
            name: MARKETING_EMAIL_FIELDS.FLEXAREAS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.FOLDERID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FOLDERID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.FOLDERID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.FREEZEDATE]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FREEZEDATE, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.FREEZEDATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.FROMNAME]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.FROMNAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.FROMNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.HTMLTITLE]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.HTMLTITLE, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.HTMLTITLE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.ID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ISGRAYMAILSUPPRESSIONENABLED]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ISGRAYMAILSUPPRESSIONENABLED,
          BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ISGRAYMAILSUPPRESSIONENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ISLOCALTIMEZONESEND]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ISLOCALTIMEZONESEND, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ISLOCALTIMEZONESEND,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ISPUBLISHED]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ISPUBLISHED, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ISPUBLISHED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.ISRECIPIENTFATIGUESUPPRESSIONENABLED]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.ISRECIPIENTFATIGUESUPPRESSIONENABLED,
          BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.ISRECIPIENTFATIGUESUPPRESSIONENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.LEADFLOWID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.LEADFLOWID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.LEADFLOWID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.LIVEDOMAIN]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.LIVEDOMAIN, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.LIVEDOMAIN,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.MAILINGLISTSEXCLUDED]: new TypeField(
          // TODO: Convert this to reference
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.MAILINGLISTSEXCLUDED, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.MAILINGLISTSEXCLUDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        [MARKETING_EMAIL_FIELDS.MAILINGLISTSINCLUDED]: new TypeField(
          // TODO: Convert this to reference
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.MAILINGLISTSINCLUDED, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.MAILINGLISTSINCLUDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        [MARKETING_EMAIL_FIELDS.MAXRSSENTRIES]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.MAXRSSENTRIES, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.MAXRSSENTRIES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.METADESCRIPTION]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.METADESCRIPTION, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.METADESCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.NAME]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.NAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PAGEEXPIRYDATE]: new TypeField( // TODO: Decide if state or not
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PAGEEXPIRYDATE, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.PAGEEXPIRYDATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PAGEEXPIRYREDIRECTEID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PAGEEXPIRYREDIRECTEID, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.PAGEEXPIRYREDIRECTEID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PAGEREDIRECTED]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PAGEREDIRECTED, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.PAGEREDIRECTED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PORTALID]: new TypeField( // TODO: Remove this?
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PORTALID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.PORTALID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PREVIEWKEY]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PREVIEWKEY, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.PREVIEWKEY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PROCESSINGSTATUS]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PROCESSINGSTATUS, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.PROCESSINGSTATUS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['UNDEFINED', 'PUBLISHED', 'PUBLISHED_OR_SCHEDULED', 'SCHEDULED', 'PROCESSING',
              'PRE_PROCESSING', 'ERROR', 'CANCELED_FORCIBLY', 'CANCELED_ABUSE'],
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHDATE]: new TypeField(
          // TODO: Human readable + decide if state
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHDATE, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHDATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHEDAT]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHEDAT, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHEDAT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHEDBYID]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHEDBYID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHEDBYID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHEDBYNAME]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHEDBYNAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHEDBYNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHIMMEDIATELY]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHIMMEDIATELY, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHIMMEDIATELY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.PUBLISHEDURL]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.PUBLISHEDURL, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.PUBLISHEDURL,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.REPLYTO]: new TypeField(
          // TODO: Decide if to enforce link to fromName?
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.REPLYTO, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.REPLYTO,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RESOLVEDDOMAIN]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RESOLVEDDOMAIN, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RESOLVEDDOMAIN,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILAUTHORLINETEMPLATE]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILAUTHORLINETEMPLATE,
          BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILAUTHORLINETEMPLATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILBLOGIMAGEMAXWIDTH]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILBLOGIMAGEMAXWIDTH,
          BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILBLOGIMAGEMAXWIDTH,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILBYTEXT]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILBYTEXT, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILBYTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILCLICKTHROUGHTEXT]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILCLICKTHROUGHTEXT,
          BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILCLICKTHROUGHTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILCOMMENTTEXT]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILCOMMENTTEXT, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILCOMMENTTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATE]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATE,
          BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATEENABLED]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATEENABLED,
          BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILENTRYTEMPLATEENABLED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSEMAILURL]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSEMAILURL, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.RSSEMAILURL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.RSSTOEMAILTIMING]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.RSSTOEMAILTIMING,
          Types.rssToEmailTimingType, {
            name: MARKETING_EMAIL_FIELDS.RSSTOEMAILTIMING,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SLUG]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SLUG, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.SLUG,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SMARTEMAILFIELDS]: new TypeField(
        // TODO: Understand this and convert to a list of smart fields
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SMARTEMAILFIELDS, BuiltinTypes.JSON, {
            name: MARKETING_EMAIL_FIELDS.SMARTEMAILFIELDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.STYLESETTINGS]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.STYLESETTINGS, BuiltinTypes.JSON, {
            name: MARKETING_EMAIL_FIELDS.STYLESETTINGS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SUBCATEGORY]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SUBCATEGORY, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.SUBCATEGORY,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
            [CORE_ANNOTATIONS.VALUES]: ['ab_master', 'ab_variant', 'automated', 'automated_for_deal', 'automated_for_form',
              'automated_for_form_legacy', 'automated_for_form_buffer', 'automated_for_form_draft',
              'rss_to_email', 'rss_to_email_child', 'blog_email', 'blog_email_child', 'optin_email', 'optin_followup_email',
              'batch', 'resubscribe_email', 'single_send_api', 'smtp_token', 'localtime', 'automated_for_ticket', 'automated_for_leadflow',
              'automated_for_feedback_ces', 'automated_for_feedback_nps', 'automated_for_feedback_custom',
            ],
          }
        ),
        [MARKETING_EMAIL_FIELDS.SUBJECT]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SUBJECT, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.SUBJECT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTION]: new TypeField(
          // TODO: Check what email subscription type is
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SUBSCRIPTION, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.SUBSCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTIONBLOGID]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SUBSCRIPTIONBLOGID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.SUBSCRIPTIONBLOGID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.SUBSCRIPTIONNAME]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.SUBSCRIPTIONNAME, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.SUBSCRIPTIONNAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.TEMPLATEPATH]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.TEMPLATEPATH, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.TEMPLATEPATH,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.TRANSACTIONAL]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.TRANSACTIONAL, BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.TRANSACTIONAL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.UNPUBLISHEDAT]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.UNPUBLISHEDAT, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.UNPUBLISHEDAT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.UPDATED]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.UPDATED, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.UPDATED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.UPDATEDBYID]: new TypeField( // TODO: Move to state only
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.UPDATEDBYID, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.UPDATEDBYID,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.URL]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.URL, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.URL,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.USERSSHEADLINEASSUBJECT]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.USERSSHEADLINEASSUBJECT,
          BuiltinTypes.BOOLEAN, {
            name: MARKETING_EMAIL_FIELDS.USERSSHEADLINEASSUBJECT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.VIDSEXCLUDED]: new TypeField(
          // TODO: No contact instances (maybe convert to email)
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.VIDSEXCLUDED, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.VIDSEXCLUDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true
        ),
        [MARKETING_EMAIL_FIELDS.VIDSINCLUDED]: new TypeField(
          // TODO: No contact instances (maybe convert to email)
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.VIDSINCLUDED, BuiltinTypes.NUMBER, {
            name: MARKETING_EMAIL_FIELDS.VIDSINCLUDED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true
        ),
        [MARKETING_EMAIL_FIELDS.WIDGETS]: new TypeField(
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.WIDGETS, BuiltinTypes.JSON, {
            name: MARKETING_EMAIL_FIELDS.WIDGETS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          }
        ),
        [MARKETING_EMAIL_FIELDS.WORKFLOWNAMES]: new TypeField( // TODO: Convert to reference
          marketingEmailElemID, MARKETING_EMAIL_FIELDS.WORKFLOWNAMES, BuiltinTypes.STRING, {
            name: MARKETING_EMAIL_FIELDS.WORKFLOWNAMES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
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

  /**
   * This method create all the (basic) field types
   */
  static getAllFieldTypes(): TypeElement[] {
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

const transformPrimitive = (val: PrimitiveValue, field: PrimitiveField):
  PrimitiveValue | undefined => {
  if (field.type.isEqual(BuiltinTypes.JSON)) {
    return JSON.stringify(val)
  }
  return val
}

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
  transform(info as Values, infoType, transformPrimitive) || {}

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
