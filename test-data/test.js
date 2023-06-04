// import { gql } from '@apolo/client'
console.log("regular javascript file");

const doSomethingWithGraphQLString = (str) => {
  // Fetch Hasura/GraphQL API do your magic...
  return str;
};

const myQueryFirst = doSomethingWithGraphQLString(/* GraphQL */ `
  query mistake {
    aaa
  }
`);

const myQuery = doSomethingWithGraphQLString(/* GraphQL */ `
  mutation a {
    login(args: { username: "", password: "1235" }) {
      headerAccessToken
      accessToken
    }
  }
  subscription test {
    notes {
      id
      subject
    }
  }
  query getNotes {
    notes {
      content
      subject
      id
    }
  }
  mutation updateNote {
    insert_notes_one(
      object: { content: "Test Note", subject: "Lorem Ipsum..." }
    ) {
      id
      subject
      content
    }
  }
  query b {
    vouchers_by_pk(id: "uuid") {
      a: campaign
      name
      type
    }
  }
  query z {
    vouchers {
      campaign
      code
      value
    }
  }
  subscription s {
    establishment_settings {
      establishment {
        id
      }
    }
  }
`);

console.log("regular javascript test file...");
