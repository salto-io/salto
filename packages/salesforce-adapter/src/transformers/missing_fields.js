"use strict";
exports.__esModule = true;
exports.defaultMissingFields = exports.convertRawMissingFields = void 0;
var missing_fields_json_1 = require("./missing_fields.json");
var isBooleanRawFieldData = function (fieldData) { return ('boolean' in fieldData); };
var toValueTypeField = function (fieldData) { return ({
    name: fieldData.name,
    soapType: fieldData.type,
    valueRequired: false,
    isForeignKey: false,
    fields: [],
    foreignKeyDomain: '',
    isNameField: false,
    minOccurs: 0,
    picklistValues: fieldData.picklistValues !== undefined
        ? fieldData.picklistValues.map(function (value) { return ({ active: true, defaultValue: false, value: value }); })
        : [],
}); };
var getFieldsFromFieldData = function (fieldData) { return (isBooleanRawFieldData(fieldData)
    ? fieldData.boolean.map(function (name) { return toValueTypeField({ name: name, type: 'boolean' }); })
    : [toValueTypeField(fieldData)]); };
var convertRawMissingFields = function (missingFieldDefinitions) { return Object.fromEntries(missingFieldDefinitions.map(function (_a) {
    var id = _a.id, fields = _a.fields;
    return [id, fields.flatMap(getFieldsFromFieldData)];
})); };
exports.convertRawMissingFields = convertRawMissingFields;
var defaultMissingFields = function () { return (exports.convertRawMissingFields(missing_fields_json_1["default"])); };
exports.defaultMissingFields = defaultMissingFields;
