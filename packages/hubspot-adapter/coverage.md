# Features support and limitations

## Single-Environment

| Feature             | Fetch  | Modify  | Add  |
|---------------------|--------|---------|------|
| Forms               |    V   |    V*   |  V*  |
| Emails              |    V   |    V*   |  V*  |
| Workflows           |    V   |    X    |  V*  |
| Contact Properties  |    V   |    V    |  V   |

X = Not supported |
V = Supported |
V* = Partially supported with limitations as described below

### Limitations

Folders management is not supported for all features.
This means that inside an environment you can not rename, delete or create Folders. You also can not move Forms/Workflows/Emails between folders.

#### Forms

Only “Regular forms” are supported. Including “Embedded forms” and “Full-page forms”. 
Pop-up forms are not supported 
Only questions connected to a Contact property are fully supported. 
Questions that are connected to Ticket/Company and all non-Contact entities are partially supported.
Modifying the GDPR Settings is not supported.
Modifying the Form’s language is not supported. 

#### Workflows

Modifying is not supported.
When creating a new Workflow there are extra validations compared to the UI. So copy pasting an existing Workflow and just changing the name might not work.

#### Emails

The “Smart rules” features support is limited to Subject.
You can’t create new smart rules through Salto. Only ones that already appear in the NaCL’s can be used (in other emails).

## Multi-environment

Multi-environment support is very limited. Some major features such as Folders structure and the ability to create/modify Records are limited and can cause unexpected behaviour.
It is currently not advised to use salto to manage multiple environments in HubSpot.