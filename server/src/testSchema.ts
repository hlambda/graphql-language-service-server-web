import { buildSchema } from "graphql";

export const schemaString = `schema {
  query: Test
  mutation: MutationType
  subscription: SubscriptionType
}

directive @onArg on ARGUMENT_DEFINITION

directive @onAllDefs on SCHEMA | SCALAR | OBJECT | FIELD_DEFINITION | INTERFACE | UNION | ENUM | ENUM_VALUE | INPUT_OBJECT | ARGUMENT_DEFINITION | INPUT_FIELD_DEFINITION

type Test {
  test: Test
  deprecatedTest: Test @deprecated(reason: "Use test instead.")
  union: TestUnion
  first: First
  id: Int
  isTest: Boolean
  hasArgs(string: String, int: Int, float: Float, boolean: Boolean, id: ID, enum: TestEnum, object: TestInput, listString: [String], listInt: [Int], listFloat: [Float], listBoolean: [Boolean], listID: [ID], listEnum: [TestEnum], listObject: [TestInput]): String
}

union TestUnion = First | Second

type First implements TestInterface & AnotherTestInterface {
  scalar: String
  first: Test
  example: String
}

interface TestInterface {
  scalar: String
}

interface AnotherTestInterface {
  example: String
}

type Second {
  second: Test
}

enum TestEnum {
  RED
  GREEN
  BLUE
}

input TestInput {
  string: String
  int: Int
  float: Float
  boolean: Boolean
  id: ID
  enum: TestEnum
  object: TestInput
  listString: [String]
  listInt: [Int]
  listFloat: [Float]
  listBoolean: [Boolean]
  listID: [ID]
  listEnum: [TestEnum]
  listObject: [TestInput]
}

"""This is a simple mutation type"""
type MutationType {
  """Set the string field"""
  setString(value: String): String
}

"""This is a simple subscription type"""
type SubscriptionType {
  """Subscribe to the test type"""
  subscribeToTest(id: String): Test
}`;

export const simpleTestSchema = `type Query {
  users: [User]
}

type User {
  id: ID!
  tata: String
  email: String
}`;

export const testSchema = buildSchema(simpleTestSchema);

export default testSchema;
