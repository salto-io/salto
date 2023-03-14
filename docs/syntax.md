# NaCl Syntax

The NaCl basic syntax is based on [HCL2](https://github.com/hashicorp/hcl/tree/hcl2) with some minor deviations.

The NaCl syntax allows defining configuration elements that usually describe both the schema and the values of configuration for a set of services.
Below is a document describing the syntax used to define these configuration elements

This document describes the following topics:
- [NaCl block types](#nacl-block-types)
- [Primitive types and values](#primitive-types-and-values)
- [Language features](#language-features)
- [Merge rules](#merge-rules)

## NaCl block types

In the NaCl language there are several types of blocks. A block has one or more labels, followed by a scope that is marked with `{}`.
The general block syntax is:
```HCL
<label1> <label2> {
  <block content>
}
```

The following types of top level blocks are supported in NaCl:
- [Type blocks](#type-blocks) - define types that are either user-defined types (in services that allow such customization) or Salto/adapter defined types that are used to describe the schema of configuration instances.
- [Instance blocks](#instance-blocks) - hold actual configuration values.
- [Settings blocks](#settings-types-and-instances) - A special case of types that allow only a single instance
- [Variables blocks](#variables-blocks) - contain variable definitions that can be referenced by other blocks.

### Type blocks

Type blocks define or extend a type element in the configuration.
Salto types have a few defining attributes:
- A name that identifies the type
- A type or category that describes what kind of value the type represents: `object`/`string`/`number`/`boolean`/`unknown` (most types are `object` types)
- Annotation values - additional information about the type
- In `object` types - fields with names and types that define the schema for instances of this type, each field is defined in a field sub-block
- Possible annotations that the type supports - defined under an `annotations` sub-block

#### Syntax
```HCL
type <type name> [is <type category>] {
  annotations {
    <annotation type> <annotation name> {
    }
  }

  <annotation name> = <value>
  
  <field type> <field name> {
    <field annotation> = <value>
  }
}
```

#### Example
```HCL
type salto.address is string {
  // This defines a primitive string type with a possible label annotation
  annotations {
    string label {
    }
  }
}

type salto.office {
  // This defines an object type with some annotations and fields
  annotations {
    string tableName {
    }
    number maxRecords {
    }
  }

  tableName = "Office"
  maxRecords = 500

  string name {
    _required = true
  }
  "List<string>" departments {
    _default = []
  }
  salto.address office_address {
    label = "Address"
  }
}
```

### Instance blocks

Instances are elements that hold configuration values.
An instance structure is determined by its type, which must always be an object type.

#### Syntax
```HCL
<type name> <instance name> {
  <field name> = <value>
}
```

#### Example
```HCL
salto.office TLV {
  name = "Tel Aviv"
  office_address = "94 Igal Alon st."
}
```

Instance values may include the fields specified by the instance's type as well as additional "untyped" values and a few built in annotations.
All of these are written in the same way, for example
```HCL
type salto.room {
  string name {
  }
}

salto.room LargeConferenceRoom {
  // a field that is defined in the salto.room type
  name = "Large Conference Room"

  // a field that is not defined in the salto.room type
  extra_info = "has a bunch of windows"

  // a built in annotation value
  _parent = [
    salto.office.instance.TLV
  ]
}
```

### Settings types and instances

Sometimes types allow only a single, unnamed, instance. this can be useful for "global" configuration information that has only one value which applies to the entire service.

In order to define a type that supports only one instance, we use a block that is exactly the same as a [type definition block](#type-blocks), but instead of the `type` keyword, we start with a `settings` keyword.
When defining an instance for a settings type, we use a block that is exactly the same as an [instance definition block](#instance-blocks), but we omit the instance name.

#### Syntax
```HCL
settings <type name> {
  // Definition of a settings type
  annotations {
    <annotation type> <annotation name> {
    }
  }

  <annotation name> = <value>
  
  <field type> <field name> {
    <field annotation> = <value>
  }
}

<type name> {
  // Definition of a settings instance
  <field name> = <value>
}
```

#### Example
```HCL
settings salto.Security {
  number passwordExpiryDays {
  }
  number passwordMinLength {
  }
}

salto.Security {
  passwordExpiryDays = 90
  passwordMinLength = 8
}
```

### Variables blocks

Variables can be useful when a certain value repeats multiple times or when we want to extract a specific value from its element for documentation purposes.

#### Syntax
```HCL
vars {
  <variable name> = <value>
}
```

#### Example
```HCL
vars {
  text_field_length = 80
}

type salto.example {
  salto.text field1 {
    length = var.text_field_length
  }
  salto.text field2 {
    length = var.text_field_length
  }
}
```

## Primitive types and values
The following types are supported in the language:
| Name        | Example field definition | Example value  | Description
|-------------|--------------------------|----------------|------------
| `string`    | string name {}           | "me"           | Use " to define single line string.
|             |                          | '''<br>Multiline<br>String<br>''' | Use ''' to define a multiline string.
| `number`    | number age {}            | 12             |
| `boolean`   | boolean isOpen {}        | true / false   |
| `List`      | "List\<string\>" listField {}| [<br>&nbsp;&nbsp;"a",<br>&nbsp;&nbsp;"b",<br>] | A list of values. contains values of a specific type
| `Map`       | "Map\<string\>" mapField {}| {<br>&nbsp;&nbsp;a = "A"<br>&nbsp;&nbsp;b = "B"<br>} | A map/dictionary with string keys, and values of the specified type
| `unknown`   | unknown anyType          | anything       | a field value which is not validated, and can hold any type of data.
| `json`      | json value {}            | "{ \"a\": 12 }"| A string value that expects the value to be in JSON format
| `serviceid` | serviceid myid {}        | "ID"           | A string value that denotes an ID in the service (used by adapters to distinguish ID fields from other fields)


## Language features

In addition to definition blocks, NaCl has several features relating to the configuration values it represents.
These include:
- [References](#references)
- [Annotations](#annotations)
- [Functions](#functions)

### References
References in NaCl represent connections between configuration elements.
These are useful to find direct and indirect relationships between configuration elements.
References allow Salto to deploy changes in the correct order and it allows Salto users to perform more advanced analysis of the configuration.

References in NaCl are written as an [element ID](user_guide.md#salto-configuration-elements) and can be found anywhere a value can be written.

#### Syntax
The syntax of a reference is the same as the syntax of an element ID.
```HCL
<service name>.<type name>
<service name>.<type name>.field.<field name>
<service name>.<type name>.instance.<instance name>[.<field value path>]
```

#### Examples
```HCL
type salto.example {
  string field1 {
  }
}

type salto.layout {
  string object {
  }
  List<string> fields {
  }
}

salto.layout default_layout {
  object = salto.example
  fields = [
    salto.example.field.field1,
    salto.example.field.field2,
  ]
}

salto.example example_instance1 {
  field1 = "some value"
}

salto.example example_instance2 {
  field1 = salto.example.instance.example_instance1.field1
}
```

### Annotations
Annotations are key-value pairs that represent important metadata about the block they are written in. Some are defined by Salto (built-in) and most are defined by service adapters (adapter-specific).

Built-in annotations are available everywhere in Salto. Their names will always begin with `_` in order to distinguish them from adapter-specific annotations (adapters cannot define an annotation that starts with `_`).

Annotations can be of any primitive type, as well as complex types.

Currently the following core annotations are supported:
- [_required](#_required)
- [_restriction](#_restriction)
- [_hidden / _hidden_value](#_hidden-_hidden_value)
- [_parent](#_parent)
- [_alias](#_alias)
- [_generated_dependencies / _depends_on](#_generated_dependencies-_depends_on)
- [_service_url](#_service_url)
- [_is_service_id](#_is_service_id)
- [_created_by](#_created_by)
- [_created_at](#_created_at)
- [_changed_by](#_changed_by)
- [_changed_at](#_changed_at)
- [_creatable](#_created_at)
- [_updatable](#_changed_by)
- [_deletable](#_changed_at)
- [_additional_properties](#_additional_properties)

#### `_required`
This annotation is used on field blocks to specify that an instance must contain a value for this field.
Instances without a value for a required field will cause a validation warning

Type: `boolean`
Default: `false`
Applicable to: Fields
Example:
```HCL
type salto.example_type {
  string mandatory_field {
    _required = true
  }
}

salto.example_type example_instance {
  // This instance will cause a warning because it does not specify a value for "mandatory_field"
}
```

#### `_restriction`
This annotation is used on field blocks to specify restrictions on the values that are valid for this field.
Instances with values that do not comply with these restrictions will cause a validation warning

Type:
- enforce_value: `boolean` - when true, the restriction should be enforced and will create a validation warning, when false, the restriction is just a hint.
- values: `list<string | number>` - a list of possible values, when this is specified, only these values are valid. the type of values is the list is determined by the type of the field.
- min: `number` - relevant for number fields, specifies the minimum valid value (inclusive).
- max: `number`- relevant for number fields, specifies the maximum valid value (inclusive).
- regex: `string` - relevant for string fields, specifies a pattern that values must match.
- max_length: `number` - relevant for string fields, specifies the maximum valid length for the field.
- max_list_length: `number` - relevant for list fields, specifies the maximum allowed values in the list.

Default: `undefined`
Applicable to: Fields
Example:
```HCL
type salto.example_type {
  number restricted_num {
    _restriction = {
      min: 5
      max: 10
    }
  }
  string restricted_string {
    _restriction = {
      values = [
        "a",
        "b",
        "c",
      ]
    }
  }
}
```

#### _hidden / _hidden_value
These annotations are used to control which values appear in NaCl files and which are "hidden".
hidden values are still part of the Salto element graph, but will not be represented in NaCl.

`_hidden` can be set on types to omit them completely from NaCl, this will not actually be seen in NaCl files because it will omit the type which contains its definition.
`_hidden_value` can be set on fields or annotation types to omit the field values from instances or the annotation values

Type: `boolean`
Default: `false`
Applicable to: Fields, Types
Example:
```HCL
type salto.hidden_number is number {
  _hidden_value = true
}

type salto.example {
  annotations {
    salto.hidden_number internalId {
    }
  }
  // there can be an internalId on this type, but it will not be here because it is a hidden value

  string normal_field {
  }

  string hidden_field {
    _hidden_value = true
  }
}

salto.example example_instance {
  normal_field = "normal"
  // there can be a hidden_field value on this instance, but it will not be here
}

```

#### _parent
This is an annotation that can hold references to other elements to represent a parent-child relationship

Type: `List<reference>`
Default: `[]`
Applicable to: Types, Instances
Example:
```HCL
salto.example parent1 {
  name = "a parent configuration element"
}

salto.example parent2 {
  name = "another parent configuration element"
}

salto.example child1 {
  _parent = [
    salto.example.instance.parent1,
    salto.example.instance.parent2,
  ]
  name = "first child"
}

salto.example child2 {
  _parent = [
    salto.example.instance.parent1,
  ]
  name = "second child"
}
```

#### _alias

This annotation is used to define a user-friendly alias for the element. The alias can be used in Salto enabled editors to display a shorter, clearer element name to users. Unlike the element ID, it does not have to be unique.

Type: `string` Default: `undefined` Applicable to: Types, Instances, Fields
Example:
```HCL
type salto.example_type_long_id {
_alias = "Example Type"
}

salto.example_type_long_id example_instance_id_with_long_prefix {
_alias = "Example Instance"
}
```


#### _generated_dependencies / _depends_on
These are place holders for additional references from one element to another.
They are needed for cases where the dependency is not derived directly from the configuration.

`_generated_dependencies` is used for references that are detected automatically by Salto.
`_depends_on` can be used by the user to add references that Salto did not automatically detect.

Type: `List<reference>`
Default: `[]`
Applicable to: Types, Instances, Fields
Example:
```HCL
type salto.example {
  number field1 {
  }
  number field2 {
  }
  number calculated_field {
    defaultValueFormula = "field1 + field2 + 5"
    _generated_dependencies = [
      salto.example.field.field1,
      salto.example.field.field2,
    ]
  }
}
```

#### _service_url
This is a hidden annotation (will not be seen in NaCl) that is used to store a URL for an element.
Elements that have this annotation can support the "Go To Service" feature in Salto enabled editors.

#### _is_service_id
This boolean annotation is used to identify fields or types as ServiceId. a ServiceId is a value that denotes an ID in the service (used by adapters to distinguish ID fields from other fields). 

Type: `boolean`
Default: `false`
Applicable to: Types, Fields
Example:
```HCL
type serviceIdTypeExample {
  _is_service_id = true
}

type salto.example {
  string fieldWithServiceIdAnno {
    _is_service_id = true
  }
}
```


#### _created_by
This is a hidden string annotation (will not be seen in NaCl) that is used to store a name of the user who created this element.\

Type: `string`
Default: `false`
Applicable to: Types, Instances, Fields

Example:
```HCL
type salto.example {
  number field1 {
  }
  _created_by = "type creator name"
  number exampleField {
    value = 5
    _created_by = "field creator name"
  }
}
```
#### _created_at
This is a hidden string annotation (will not be seen in NaCl) that is used to store the time the element was created.
The time format is ISO-8601

Type: `string`
Default: `false`
Applicable to: Types, Instances, Fields

Example:
```HCL
type salto.example {
  number field1 {
  }
  _created_at = "2021-04-01T00:00:00.000Z"
  number exampleField {
    value = 5
    _created_at = "2021-04-01T00:00:00.000Z"
  }
}
```

#### _changed_by
This is a hidden string annotation (will not be seen in NaCl) that is used to store a name of the user who last changed this element.

Type: `string`
Default: `false`
Applicable to: Types, Instances, Fields

Example:
```HCL
type salto.example {
  number field1 {
  }
  _changed_by = "type creator name"
  number exampleField {
    value = 5
    _changed_by = "field creator name"
  }
}
```

#### _changed_at
This is a hidden string annotation (will not be seen in NaCl) that is used to store the last time this element was changed.
The time format is ISO-8601

Type: `string`
Default: `false`
Applicable to: Types, Instances, Fields

Example:
```HCL
type salto.example {
  number field1 {
  }
  _changed_at = "2021-05-01T00:00:00.000Z"
  number exampleField {
    value = 5
    _changed_at = "2021-05-02T00:00:00.000Z"
  }
}
```

#### _creatable
This is a hidden boolean annotation (will not be seen in NaCl) that is used to set whether creating instances of a type or certain value in it is supported.

Type: `boolean`
Default: `true`
Applicable to: Types, Fields

Example:

For the type
```HCL
type salto.example {
  number nonCreatableField {
    _creatable = false
  }
  number creatableField {
    _creatable = true
  }
  _creatable = true
}
```

The following new instance will be deployed without any error:
```HCL
salto.example valid {
  creatableField = 1
}
```

For the following new instance, a warning will be shown in the deploy preview:
```HCL
salto.example invalid {
  creatableField = 1
  nonCreatableField = 1
}
```

#### _updatable
This is a hidden boolean annotation (will not be seen in NaCl) that is used to set whether a modification of an instance or a certain value in an instance is supported.

Type: `boolean`
Default: `true`
Applicable to: Types, Fields

Example:
For the types
```HCL
type salto.updatable {
  number nonUpdatableField {
    _updatable = false
  }
  number updatableField {
    _updatable = true
  }
  _updatable = true
}

type salto.notUpdatable {
  number someField {
  }
  _updatable = false
}
```

The following instance changes will be deployed without any error:
```HCL
// before
salto.updatable valid {
  updatableField = 1
}

// after
salto.updatable valid {
  updatableField = 2
}
```

```HCL
// before
salto.updatable valid {
  nonUpdatableField = 1
  updatableField = 1
}

// after
salto.updatable valid {
  nonUpdatableField = 1
  updatableField = 2
}
```

For the following instance change, a warning will be shown to the user before deploying:
```HCL
// before
salto.updatable invalid {
  nonUpdatableField = 1
  updatableField = 1
}

// after
salto.updatable invalid {
  nonUpdatableField = 2
  updatableField = 2
}
```

For the following instance change, an error will be shown to the user on deploy and the change will not be deployed:
```HCL
// before
salto.notUpdatable invalid {
  someField = 1
}

// after
salto.notUpdatable invalid {
  someField = 2
}
```

#### _deletable
This is a hidden boolean annotation (will not be seen in NaCl) that is used to set whether a deletion of an instance is supported.

Type: `boolean`
Default: `true`
Applicable to: Types

Example:
For the types
```HCL
type salto.deletable {
  number someField {
  }
  _deletable = false
}

type salto.notDeletable {
  number someField {
  }
  _deletable = true
}
```

The deletion of the following instance will be deployed without any error:
```HCL
salto.deletable instance {
  someField = 2
}
```

For the deletion of the following instance, an error will be shown to the user and the change will not be deployed:
```HCL
salto.notDeletable instance {
  someField = 2
}
```

#### `_additional_properties`
This annotation can be used on types to specify whether the type allows additional properties.
When it is set to false, values of this type may only contain the fields that this type allows, any additional value would cause a validation warning.

Type: `boolean`
Default: `true`
Applicable to: Types
Example:
```HCL
type salto.example_type {
  number field {
  }
  _additional_properties = false
}

salto.example_type example_instance {
  field = 1 // This is valid, as 'field' is a property of the type
  other_field = 2 // This will cause a warning because 'other_field' does not appear in the type definition
}
```

#### Adapter-specific annotations example
Below we will use examples from the Salesforce adapter.
In Salesforce it is possible to define custom types, these types have "label"s which are the names of these types as they show up in the salesforce UI. because of that, the Salto salesforce adapter supports a "label" annotation on custom types:
```HCL
type salesforce.MyCustomLead__c {
  label = "My Custom Lead"
}
```

Annotations can also be complex.
For example, when we create a custom field of type "Lookup" (which represent a relationship in salesforce), we can define a complex "filter" that chooses exactly which records in salesforce are the target of the relationship using the `lookupFilter` annotation:
```HCL
type salesforce.MyCustomLead__c {
  salesforce.Lookup Case__c {
    lookupFilter = {
      active = true
      filterItems = [
        {
          field = "Case.OwnerId"
          operation = "equals"
          valueField = "$User.Id"
        },
      ]
      infoMessage = "window text"
      isOptional = true
    }
  }
}
```

### Functions

Values in NaCl can be calculated using functions, function syntax in NaCl values is as follows:
```HCL
<field name> = <function  name>(<parameter 1>, <parameter 2>, ...)
```

In the example below, the value of the `logo` field in the instance would be the content of the `my_logo.png` file:
```HCL
salto.example example_instance {
  logo = file("my_logo.png")
}
```

Currently the following functions are available:
- [file](#the-file-function)

#### The `file` function
Function signature: `file(path, encoding)`
Arguments:
  - `path`: The path of the file to load content from, relative to the `static-files` folder in the workspace
  - `encoding`: The encoding used to load the content of the file (default is `binary` - meaning, no encoding), this is usually useful for text files


## Merge rules

Type and instance definitions may generally be split across multiple files / blocks while still representing the same element.
When parsing NaCl files, the Salto tools will load definitions from all files and merge them into one semantic element that contains the combination of all definition blocks.

For example, the following two type definitions are equivalent:
```HCL
type salto.test {
  string title {
  }
}

type salto.test {
  string name {
  }
}
```
and
```HCL
type salto.test {
  string title {
  }
  string name {
  }
}
```

The same goes from instance definitions, so the following definitions are equivalent:
```HCL
salto.test my_test {
  title = "Sir"
}

salto.test my_test {
  name = "Configalot"
}
```
and
```HCL
salto.test my_test {
  title = "Sir"
  name = "Configalot"
}
```

### Value merging limitations
When an instance is created it does not have to set values to all of the type fields.
It's possible to create an instance in partial blocks, as long as:

- All blocks have the same identifier (type and name)
- There are no collisions, i.e. each value is set only once across all definitions (specifically each primitive or list value can be set only once)

In the example below we're creating only one `salto.employee` instance, using two separate blocks that have the same identifier and do not collide:

```HCL
salto.employee john_doe {
  name = "John Doe"
  nicknames = ["Johnny"]
  office = {
    name = "Salto TLV"
  }
}

salto.employee john_doe {
  company = "Salto"
  office = {
    location = {
      city = "Tel Aviv"
    }
  }
}
```
Note that `office` was set in both instance blocks but is still valid because `office` is not a primitive value and inside the different definitions of `office` there were no conflicts between primitive value keys.
In the above example, if we added a `name = "Salto TLV"` to the second office definition it would become invalid as it would attempt to define the primitive value of `name` in multiple blocks.

The following example is **not valid** due to a conflicting definition of a list value:
```HCL
salto employee john_doe {
  nicknames = ["Johnny"]
}
salto employee john_doe {
  nicknames = ["JD"]
}
```

In the case of `settings` types the same rules apply, and since there are no instance name identifiers, all instance blocks of the same `settings` type will be merged into one.


### Type merging limitations
When multiple type definitions have the same name we will attempt to merge them in the following way:
- The type will contain field definitions from all blocks, as long as each field is defined once. if the same field name has more than one definition it will be considered an error.
- Annotation values on the type itself will follow the same rules as [instance values](#value-merging-limitations).

